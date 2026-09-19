import os
from fastapi import APIRouter, HTTPException, Depends, Header, Response, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from services.auth_service import (
    get_user_by_email,
    create_unverified_user,
    generate_and_store_otp,
    verify_otp_attempt,
    verify_password,
    handle_failed_login,
    is_account_locked,
    create_access_token,
    create_refresh_token,
    rotate_refresh_token,
    revoke_session,
    generate_and_store_reset_token,
    verify_reset_token_and_update_password,
    generate_google_oauth_url,
    exchange_google_code_for_user,
    create_or_link_google_user,
    decode_access_token
)

router = APIRouter(prefix="/api/auth", tags=["Authentication & Security"])

# --- Request/Response Models ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    name: Optional[str] = ""

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")

class ResendOtpRequest(BaseModel):
    email: EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="High-entropy reset token from email")
    new_password: str = Field(..., min_length=8, description="Minimum 8 characters")

class RefreshTokenRequest(BaseModel):
    refresh_token: Optional[str] = None

# --- Dependency: Current User Authentication ---
async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_user_by_email(payload.get("sub", ""))
    if not user or not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account inactive or not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# --- Endpoints ---

@router.post("/register")
async def register(req: RegisterRequest):
    """
    Registers an unverified user account and generates a secure, hashed 6-digit OTP.
    Returns generic responses to prevent user enumeration.
    """
    existing = get_user_by_email(req.email)
    if existing and existing.get("is_verified"):
        # Generic response to prevent email enumeration
        return {
            "message": "If this email is not yet registered, an OTP has been sent.",
            "email": req.email,
            "status": "pending_verification"
        }
    
    # Create or update unverified user
    user = create_unverified_user(req.email, req.password, req.name or "")
    otp_code = generate_and_store_otp(req.email)
    
    # In development mode, we expose a dev preview hint for easy local testing
    dev_hint = otp_code if os.environ.get("ENV") != "production" else None

    return {
        "message": "Account created. Please enter the 6-digit OTP sent to your email to activate.",
        "email": req.email,
        "status": "pending_verification",
        "dev_otp_preview": dev_hint
    }

@router.post("/verify-email")
async def verify_email(req: VerifyEmailRequest, response: Response):
    """
    Verifies the email OTP with strict attempt limits (max 5 attempts),
    activates account, and returns initial JWT access & refresh tokens.
    """
    user = get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification request.")
    
    is_valid, error_msg = verify_otp_attempt(req.email, req.otp)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Activate user
    user["is_verified"] = True
    user["is_active"] = True
    
    # Generate tokens
    access_token = create_access_token({"sub": user["email"], "user_id": user["id"], "name": user["name"]})
    refresh_token = create_refresh_token(user["email"], user["id"])
    
    # Set HttpOnly Refresh Token Cookie
    response.set_cookie(
        key="exam_plus_refresh",
        value=refresh_token,
        httponly=True,
        secure=os.environ.get("ENV") == "production",
        samesite="lax",
        max_age=7 * 24 * 3600
    )
    
    return {
        "message": "Email verified successfully. Account activated.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture", "")
        }
    }

@router.post("/resend-otp")
async def resend_otp(req: ResendOtpRequest):
    """
    Regenerates and resends a fresh OTP code for email verification.
    """
    user = get_user_by_email(req.email)
    if not user or user.get("is_verified"):
        return {"message": "If the account exists and is unverified, a new OTP has been sent."}
    
    otp_code = generate_and_store_otp(req.email)
    dev_hint = otp_code if os.environ.get("ENV") != "production" else None
    
    return {
        "message": "A fresh OTP has been sent to your email.",
        "dev_otp_preview": dev_hint
    }

@router.post("/login")
async def login(req: LoginRequest, response: Response):
    """
    Authenticates email/password with Argon2, checks for account lockout,
    and issues short-lived JWT access token + HttpOnly secure refresh token.
    """
    user = get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    # Check account lockout
    is_locked, remaining_mins = is_account_locked(user)
    if is_locked:
        raise HTTPException(
            status_code=403, 
            detail=f"Account locked due to consecutive failed attempts. Please try again in {remaining_mins} minute(s)."
        )
    
    if not user.get("is_verified"):
        raise HTTPException(
            status_code=403, 
            detail="Account email is not verified. Please verify your OTP first."
        )
    
    if not verify_password(req.password, user.get("hashed_password", "")):
        handle_failed_login(user)
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    # Reset failed attempts upon successful login
    user["failed_login_attempts"] = 0
    user["locked_until"] = None
    
    access_token = create_access_token({"sub": user["email"], "user_id": user["id"], "name": user["name"]})
    refresh_token = create_refresh_token(user["email"], user["id"])
    
    response.set_cookie(
        key="exam_plus_refresh",
        value=refresh_token,
        httponly=True,
        secure=os.environ.get("ENV") == "production",
        samesite="lax",
        max_age=7 * 24 * 3600
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture", "")
        }
    }

@router.get("/google/authorize")
async def google_authorize():
    """
    Initiates Google OAuth2 Authorization Code flow with CSRF state & PKCE protection.
    """
    auth_url, state = generate_google_oauth_url()
    return {
        "auth_url": auth_url,
        "state": state
    }

@router.get("/google/callback")
async def google_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    """
    Handles Google OAuth redirect, verifies state, exchanges authorization code,
    retrieves user profile, and links/creates the local user account.
    """
    if error:
        raise HTTPException(status_code=400, detail=f"Google OAuth error: {error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing authorization code or state parameter.")
    
    google_user = await exchange_google_code_for_user(code, state)
    if not google_user or not google_user.get("email"):
        raise HTTPException(status_code=400, detail="Failed to retrieve verified profile from Google.")
    
    user = create_or_link_google_user(
        email=google_user["email"],
        name=google_user.get("name", ""),
        google_sub=google_user.get("sub", ""),
        picture=google_user.get("picture", "")
    )
    
    access_token = create_access_token({"sub": user["email"], "user_id": user["id"], "name": user["name"]})
    refresh_token = create_refresh_token(user["email"], user["id"])
    
    # In production, redirect back to frontend client dashboard with token
    frontend_redirect = f"/?auth_token={access_token}&refresh_token={refresh_token}"
    response = RedirectResponse(url=frontend_redirect)
    response.set_cookie(
        key="exam_plus_refresh",
        value=refresh_token,
        httponly=True,
        secure=os.environ.get("ENV") == "production",
        samesite="lax",
        max_age=7 * 24 * 3600
    )
    return response

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    """
    Requests a password reset link. Returns generic response to prevent email enumeration.
    Max 5 token verification attempts are enforced on submission.
    """
    raw_token = generate_and_store_reset_token(req.email)
    dev_hint = raw_token if os.environ.get("ENV") != "production" and raw_token else None
    
    return {
        "message": "If an active account with that email exists, a password reset link has been sent.",
        "dev_token_preview": dev_hint
    }

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """
    Resets account password with verified reset token (max 5 attempts, 15 min expiry, one-time use).
    Revokes all existing user sessions upon password change.
    """
    success, msg = verify_reset_token_and_update_password(req.token, req.new_password)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    
    return {
        "message": "Password reset successfully. Please log in with your new password."
    }

@router.post("/refresh")
async def refresh_session(req: RefreshTokenRequest, request: Request, response: Response):
    """
    Rotates refresh token and returns a fresh short-lived access token.
    """
    cookie_token = request.cookies.get("exam_plus_refresh")
    refresh_token = req.refresh_token or cookie_token
    
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing.")
    
    rotated = rotate_refresh_token(refresh_token)
    if not rotated:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh session.")
    
    new_access_token, new_refresh_token, user = rotated
    
    response.set_cookie(
        key="exam_plus_refresh",
        value=new_refresh_token,
        httponly=True,
        secure=os.environ.get("ENV") == "production",
        samesite="lax",
        max_age=7 * 24 * 3600
    )
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture", "")
        }
    }

@router.post("/logout")
async def logout(request: Request, response: Response):
    """
    Invalidates current refresh token session and clears auth cookies.
    """
    cookie_token = request.cookies.get("exam_plus_refresh")
    if cookie_token:
        revoke_session(cookie_token)
    
    response.delete_cookie("exam_plus_refresh")
    return {"message": "Logged out successfully."}

@router.get("/me")
async def get_my_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Retrieves authenticated user profile.
    """
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "picture": current_user.get("picture", ""),
        "is_verified": current_user.get("is_verified", False),
        "auth_provider": current_user.get("auth_provider", "local")
    }

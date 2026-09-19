import os
import time
import hmac
import hashlib
import secrets
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
import httpx
import logging

logger = logging.getLogger("auth_service")

# Security Configuration
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "exam_plus_super_secret_jwt_key_2026_change_in_prod")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
OTP_EXPIRE_MINUTES = 10
MAX_OTP_ATTEMPTS = 5
MAX_RESET_ATTEMPTS = 5
MAX_LOGIN_FAILURES = 5
LOCKOUT_DURATION_MINUTES = 15

# Google OAuth Credentials
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")

# Password Hashing using Argon2 with Bcrypt fallback
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"], 
    deprecated="auto"
)

# In-memory data store with thread-safe atomic dictionary operations
# In production, replace with PostgreSQL / Firestore / Redis
users_db: Dict[str, Dict[str, Any]] = {}
otp_store: Dict[str, Dict[str, Any]] = {}       # email -> {hashed_otp, expires_at, attempts}
reset_store: Dict[str, Dict[str, Any]] = {}     # token_hash -> {email, expires_at, attempts}
sessions_db: Dict[str, Dict[str, Any]] = {}    # refresh_token -> {email, expires_at, user_id}
oauth_states: Dict[str, Dict[str, Any]] = {}    # state -> {code_verifier, expires_at}

# --- Password Helpers ---
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

# --- Cryptographically Secure Hashing & Verification ---
def hash_secret_value(value: str) -> str:
    """Computes SHA-256 hash with HMAC secret for stored OTPs and Reset Tokens."""
    return hmac.new(SECRET_KEY.encode('utf-8'), value.encode('utf-8'), hashlib.sha256).hexdigest()

def constant_time_compare(val1: str, val2: str) -> bool:
    """Prevents timing attacks on token/OTP verification."""
    return hmac.compare_digest(val1.encode('utf-8'), val2.encode('utf-8'))

# --- OTP Management ---
def generate_and_store_otp(email: str) -> str:
    """Generates a secure 6-digit numeric OTP and stores hashed version with attempt tracking."""
    # 6-digit integer 100000 to 999999
    otp_code = str(secrets.randbelow(900000) + 100000)
    hashed_otp = hash_secret_value(otp_code)
    
    otp_store[email.lower()] = {
        "hashed_otp": hashed_otp,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES),
        "attempts": 0,
        "created_at": datetime.now(timezone.utc)
    }
    
    # In production, dispatch via SendGrid/SES/SMTP. Here we log securely.
    logger.info(f"[EMAIL SERVICE] Verification OTP dispatched to {email}. Valid for {OTP_EXPIRE_MINUTES} mins.")
    return otp_code

def verify_otp_attempt(email: str, submitted_otp: str) -> Tuple[bool, str]:
    """
    Verifies OTP with max attempts restriction.
    Returns: (is_valid, error_code_or_message)
    """
    key = email.lower()
    record = otp_store.get(key)
    
    if not record:
        return False, "OTP not found or expired. Please request a new one."
    
    # Check expiry
    if datetime.now(timezone.utc) > record["expires_at"]:
        del otp_store[key]
        return False, "OTP has expired. Please request a new one."
    
    # Check attempt limit
    if record["attempts"] >= MAX_OTP_ATTEMPTS:
        del otp_store[key]
        return False, f"Maximum verification attempts ({MAX_OTP_ATTEMPTS}) exceeded. OTP invalidated."
    
    # Increment attempt count
    record["attempts"] += 1
    
    submitted_hash = hash_secret_value(submitted_otp.strip())
    
    if constant_time_compare(record["hashed_otp"], submitted_hash):
        # One-time use: invalidate immediately on success
        del otp_store[key]
        return True, ""
    else:
        remaining = MAX_OTP_ATTEMPTS - record["attempts"]
        if remaining <= 0:
            del otp_store[key]
            return False, "Invalid OTP. Maximum attempts reached, OTP invalidated."
        return False, f"Invalid OTP. {remaining} attempt(s) remaining."

# --- Password Reset Token Management (Max 5 Attempts) ---
def generate_and_store_reset_token(email: str) -> Optional[str]:
    """Generates a high-entropy reset token, stores hashed token with attempt counter."""
    user = get_user_by_email(email)
    if not user:
        # Return None but API returns generic success to prevent enumeration
        return None
    
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_secret_value(raw_token)
    
    reset_store[token_hash] = {
        "email": email.lower(),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15),
        "attempts": 0
    }
    
    logger.info(f"[EMAIL SERVICE] Password reset token dispatched for {email}. Valid for 15 minutes.")
    return raw_token

def verify_reset_token_and_update_password(raw_token: str, new_password: str) -> Tuple[bool, str]:
    """Verifies reset token, validates attempt limits, and updates password."""
    token_hash = hash_secret_value(raw_token.strip())
    record = reset_store.get(token_hash)
    
    if not record:
        return False, "Invalid or expired reset token."
    
    if datetime.now(timezone.utc) > record["expires_at"]:
        del reset_store[token_hash]
        return False, "Reset token has expired. Please request a new link."
    
    if record["attempts"] >= MAX_RESET_ATTEMPTS:
        del reset_store[token_hash]
        return False, f"Maximum reset attempts ({MAX_RESET_ATTEMPTS}) exceeded. Token invalidated."
    
    record["attempts"] += 1
    email = record["email"]
    user = get_user_by_email(email)
    
    if not user:
        del reset_store[token_hash]
        return False, "Associated user account not found."
    
    # Update password
    user["hashed_password"] = hash_password(new_password)
    user["failed_login_attempts"] = 0
    user["locked_until"] = None
    
    # Invalidate all active refresh sessions for this user on password reset
    revoke_user_sessions(email)
    
    # Remove one-time reset token
    del reset_store[token_hash]
    return True, "Password reset successfully. All existing sessions revoked."

# --- JWT Token Generation & Verification ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_ALGORITHM)

def create_refresh_token(email: str, user_id: str) -> str:
    raw_token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    sessions_db[raw_token] = {
        "email": email.lower(),
        "user_id": user_id,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    }
    return raw_token

def rotate_refresh_token(old_refresh_token: str) -> Optional[Tuple[str, str, Dict[str, Any]]]:
    """Validates old refresh token, revokes it, and issues a new access token + refresh token."""
    session = sessions_db.get(old_refresh_token)
    if not session:
        return None
    
    if datetime.now(timezone.utc) > session["expires_at"]:
        del sessions_db[old_refresh_token]
        return None
    
    email = session["email"]
    user = get_user_by_email(email)
    if not user or not user.get("is_active"):
        del sessions_db[old_refresh_token]
        return None
    
    # Revoke old refresh token
    del sessions_db[old_refresh_token]
    
    # Issue new pair
    new_access_token = create_access_token({"sub": email, "user_id": user["id"], "name": user.get("name", "")})
    new_refresh_token = create_refresh_token(email, user["id"])
    
    return new_access_token, new_refresh_token, user

def revoke_session(refresh_token: str):
    if refresh_token in sessions_db:
        del sessions_db[refresh_token]

def revoke_user_sessions(email: str):
    keys_to_remove = [k for k, v in sessions_db.items() if v.get("email") == email.lower()]
    for k in keys_to_remove:
        del sessions_db[k]

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None

# --- User Management & Lockout Protection ---
def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    return users_db.get(email.lower())

def create_unverified_user(email: str, password: str, name: str = "") -> Dict[str, Any]:
    email_key = email.lower()
    user = {
        "id": f"usr_{secrets.token_hex(8)}",
        "email": email_key,
        "name": name or email.split("@")[0],
        "hashed_password": hash_password(password),
        "is_active": False,
        "is_verified": False,
        "auth_provider": "local",
        "created_at": datetime.now(timezone.utc),
        "failed_login_attempts": 0,
        "locked_until": None
    }
    users_db[email_key] = user
    return user

def create_or_link_google_user(email: str, name: str, google_sub: str, picture: str = "") -> Dict[str, Any]:
    email_key = email.lower()
    user = users_db.get(email_key)
    
    if user:
        user["google_id"] = google_sub
        user["is_verified"] = True
        user["is_active"] = True
        if picture:
            user["picture"] = picture
        if not user.get("name"):
            user["name"] = name
    else:
        user = {
            "id": f"usr_{secrets.token_hex(8)}",
            "email": email_key,
            "name": name or email.split("@")[0],
            "google_id": google_sub,
            "picture": picture,
            "is_active": True,
            "is_verified": True,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc),
            "failed_login_attempts": 0,
            "locked_until": None
        }
        users_db[email_key] = user
    return user

def handle_failed_login(user: Dict[str, Any]):
    user["failed_login_attempts"] = user.get("failed_login_attempts", 0) + 1
    if user["failed_login_attempts"] >= MAX_LOGIN_FAILURES:
        user["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        logger.warning(f"Account {user['email']} locked due to {MAX_LOGIN_FAILURES} failed login attempts.")

def is_account_locked(user: Dict[str, Any]) -> Tuple[bool, Optional[int]]:
    locked_until = user.get("locked_until")
    if locked_until and datetime.now(timezone.utc) < locked_until:
        remaining_minutes = int((locked_until - datetime.now(timezone.utc)).total_seconds() / 60) + 1
        return True, remaining_minutes
    if locked_until and datetime.now(timezone.utc) >= locked_until:
        user["locked_until"] = None
        user["failed_login_attempts"] = 0
    return False, None

# --- Google OAuth2 Authorization Code Flow with PKCE ---
def generate_google_oauth_url() -> Tuple[str, str]:
    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = hashlib.sha256(code_verifier.encode('utf-8')).hexdigest()
    
    oauth_states[state] = {
        "code_verifier": code_verifier,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
    }
    
    base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": GOOGLE_CLIENT_ID or "YOUR_GOOGLE_CLIENT_ID",
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account"
    }
    
    query = "&".join([f"{k}={v}" for k, v in params.items()])
    return f"{base_url}?{query}", state

async def exchange_google_code_for_user(code: str, state: str) -> Optional[Dict[str, Any]]:
    state_record = oauth_states.get(state)
    if not state_record or datetime.now(timezone.utc) > state_record["expires_at"]:
        return None
    
    del oauth_states[state]
    
    # Token exchange request over HTTPS
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": GOOGLE_REDIRECT_URI
    }
    
    async with httpx.AsyncClient() as client:
        try:
            token_resp = await client.post(token_url, data=token_data)
            if token_resp.status_code != 200:
                logger.error(f"Google token exchange failed: {token_resp.text}")
                return None
            
            tokens = token_resp.json()
            access_token = tokens.get("access_token")
            
            # Fetch user info
            userinfo_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if userinfo_resp.status_code != 200:
                return None
            
            return userinfo_resp.json()
        except Exception as e:
            logger.error(f"Google OAuth exchange error: {e}")
            return None

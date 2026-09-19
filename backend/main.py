import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routes.ai_routes import router as ai_router
from routes.auth_routes import router as auth_router

load_dotenv()

app = FastAPI(
    title="Exam Plus AI API",
    description="Production-grade Backend API service with hardened authentication, PYQ Analysis, and Model Answer Generation",
    version="1.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth_router)
app.include_router(ai_router)

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "Exam Plus Python API",
        "framework": "FastAPI",
        "features": [
            "argon2_password_hashing",
            "email_otp_verification",
            "google_oauth2_pkce",
            "forgot_password_max_5_attempts",
            "jwt_and_refresh_tokens"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

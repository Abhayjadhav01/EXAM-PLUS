# Exam Plus - Universal PYQ Analyzer & Model Answer Generator

Exam Plus is an AI-powered educational platform designed to analyze Previous Year Question (PYQ) papers, extract questions, detect semantic duplicates, calculate topic trends, generate topper-grade university model answers, create AI study strategies, and export revision handbooks as clean PDFs.

---

## 📂 Repository Architecture

The project is structured into standalone **`frontend/`** and **`backend/`** modules:

```text
exam-plus/
│
├── frontend/                     # React 19 Frontend Application
│   ├── public/                   # Static assets & icons
│   ├── src/                      # Source React components & state management
│   │   ├── components/           # UI components (AnalysisDashboard, AnswerRenderer, etc.)
│   │   ├── services/             # API clients (ai, auth, pdf, etc.)
│   │   ├── hooks/                # Custom React hooks (e.g. Firebase Firestore)
│   │   ├── App.tsx               # Main React Application
│   │   ├── firebase.ts           # Firebase configuration
│   │   ├── main.tsx              # React entry point
│   │   └── types.ts              # Global TypeScript interfaces
│   ├── Dockerfile                # Nginx production container build
│   ├── package.json              # Frontend node dependencies
│   ├── tsconfig.json             # TypeScript config
│   └── vite.config.ts            # Vite bundler configuration
│
├── backend/                      # Python FastAPI Backend Engine
│   ├── main.py                   # Main FastAPI server entry point
│   ├── routes/                   # API Routers
│   │   ├── auth_routes.py        # Hardened Auth, OTP, Google OAuth2, Password Reset
│   │   └── ai_routes.py          # AI Analysis & Answer Endpoints
│   ├── services/                 # Business Logic & Orchestrators
│   │   ├── auth_service.py       # Argon2, OTP hasher, token rotation, lockout
│   │   └── gemini_orchestrator.py# Google GenAI prompt engineering & paper parser
│   ├── Dockerfile                # Python Uvicorn container build
│   └── requirements.txt          # Python dependencies (FastAPI, passlib, jose, etc.)
│
├── docker-compose.yml            # Multi-container local & hosting orchestration
└── README.md                     # Repository documentation
```

---

## 🔐 Hardened Authentication & Security Flow

| Security Flow | Implementation Details |
| :--- | :--- |
| **Password Hashing** | Uses **Argon2id** (with fallback to bcrypt) via `passlib`. |
| **Email OTP Verification** | Cryptographically secure 6-digit OTP stored as **SHA-256 HMAC hash** with **10-minute expiry**, **max 5 verification attempts**, and one-time auto-invalidation. |
| **Google OAuth2** | Full **Authorization Code Flow with PKCE & CSRF state verification** through backend callback (`/api/auth/google/callback`). |
| **Forgot Password** | High-entropy URL-safe token, stored hashed, **15-minute validity**, **max 5 attempts per token**, generic enumeration-safe responses. Revokes all active refresh tokens upon password reset. |
| **Session Management** | Short-lived **JWT Access Tokens (30m)** paired with **HttpOnly Secure SameSite Refresh Tokens (7d)** with rotation on use. |
| **Lockout Protection** | Automatic **15-minute account lockout** after 5 consecutive failed login attempts. |
| **Timing Attack Defense** | Constant-time string and hash comparisons (`hmac.compare_digest`). |

---

## 📡 API Reference

### 1. Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register unverified account & trigger email OTP |
| `POST` | `/api/auth/verify-email` | Verify 6-digit OTP (max 5 attempts) and activate account |
| `POST` | `/api/auth/resend-otp` | Generate and resend fresh OTP |
| `POST` | `/api/auth/login` | Email/password login with lockout protection & JWT issuance |
| `GET` | `/api/auth/google/authorize` | Initiate Google OAuth2 flow with state & PKCE |
| `GET` | `/api/auth/google/callback` | Google OAuth2 callback & token exchange |
| `POST` | `/api/auth/forgot-password` | Request password reset link (enumeration-safe) |
| `POST` | `/api/auth/reset-password` | Reset password using token (max 5 attempts, one-time) |
| `POST` | `/api/auth/refresh` | Rotate refresh token and issue new access token |
| `POST` | `/api/auth/logout` | Revoke session & clear cookies |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |

### 2. AI & PYQ Endpoints (`/api/ai`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status |
| `POST` | `/api/ai/analyze-papers` | Extracts & clusters questions from PYQ papers |
| `POST` | `/api/ai/generate-answer` | Generates topper-grade university model answers |
| `POST` | `/api/ai/chat` | Context-aware AI study chatbot |
| `POST` | `/api/ai/study-strategy` | Generates personalized revision strategy |

---

## 🚀 Quick Start

### Running with Docker Compose
```bash
GEMINI_API_KEY="your_api_key" docker-compose up --build
```

- **Frontend UI**: `http://localhost:3000`
- **Backend FastAPI Docs**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/api/health`

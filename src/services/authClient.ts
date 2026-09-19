// Frontend Authentication Client for FastAPI Auth Service

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  is_verified?: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

const TOKEN_KEY = 'exam_plus_access_token';
const USER_KEY = 'exam_plus_user_data';

export const authClient = {
  getStoredAuth(): AuthState {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const userStr = localStorage.getItem(USER_KEY);
      if (token && userStr) {
        return {
          user: JSON.parse(userStr),
          accessToken: token,
          isAuthenticated: true
        };
      }
    } catch (e) {
      console.warn('Failed to parse stored auth session:', e);
    }
    return { user: null, accessToken: null, isAuthenticated: false };
  },

  setAuthSession(token: string, user: AuthUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearAuthSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  async register(email: string, password: string, name?: string) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Registration failed');
    return data;
  },

  async verifyEmailOtp(email: string, otp: string) {
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'OTP verification failed');
    if (data.access_token && data.user) {
      this.setAuthSession(data.access_token, data.user);
    }
    return data;
  },

  async resendOtp(email: string) {
    const res = await fetch('/api/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to resend OTP');
    return data;
  },

  async login(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Login failed');
    if (data.access_token && data.user) {
      this.setAuthSession(data.access_token, data.user);
    }
    return data;
  },

  async forgotPassword(email: string) {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Password reset request failed');
    return data;
  },

  async resetPassword(token: string, new_password: string) {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Password reset failed');
    return data;
  },

  async startGoogleLogin() {
    const res = await fetch('/api/auth/google/authorize');
    const data = await res.json();
    if (data.auth_url) {
      window.location.href = data.auth_url;
    }
  },

  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout API error:', e);
    }
    this.clearAuthSession();
  }
};

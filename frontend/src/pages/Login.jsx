import { useState } from "react";

import "../styles/login.css";

import bacnotanLogo from "../assets/Bacnotan Logo.png";
import hiveLogo from "../assets/Hive-logo.png";

import API_BASE from "../config/api";

import {
  LogIn,
  Eye,
  EyeOff,
  CheckCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

function Login({ onLogin }) {
  const [email, setEmail] = useState(
    localStorage.getItem("hivesync_remember_email") || ""
  );

  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] = useState(
    !!localStorage.getItem("hivesync_remember_email")
  );

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const logAction = async (userData, action, details) => {
    try {
      await fetch(`${API_BASE}/audit_trail/log_action.php`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userData?.user_id || null,
          user_name: userData?.full_name || email,
          module: "Authentication",
          action,
          details,
        }),
      });
    } catch {
    }
  };

  const handleLogin = async () => {
    if (loading) return;

    setError("");
    setSuccess(false);

    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login.php`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        await logAction(
          { full_name: email },
          "Failed Login",
          `Failed login attempt using ${email}`
        );

        setError(data.message || "Invalid email or password.");
        setLoading(false);
        return;
      }

      setSuccess(true);

      if (rememberMe) {
        localStorage.setItem(
          "hivesync_remember_email",
          email.trim()
        );
      } else {
        localStorage.removeItem("hivesync_remember_email");
      }

      localStorage.setItem(
        "hivesync_user",
        JSON.stringify(data.user)
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      await logAction(
        data.user,
        "Login",
        `${data.user.full_name} logged in as ${data.user.role}`
      );

      setTimeout(() => {
        onLogin(data.user);
      }, 700);
    } catch {
      setError(
        "Cannot connect to backend. Check Laragon and backend configuration."
      );

      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-accent" />

        <div className="login-header">
          <div className="logo-icon">
            <img
              src={bacnotanLogo}
              alt="Bacnotan Logo"
              className="logo-img logo-img-bacnotan"
            />

            <img
              src={hiveLogo}
              alt="Hive Logo"
              className="logo-img logo-img-hive"
            />
          </div>

          <h1>HiveSync</h1>

          <p>
            Integrated Business and Operations Management System
          </p>

          <div className="login-badge">
            <ShieldCheck size={14} />

            <span>
              Bacnotan Farmers Agri-Tourism Center
            </span>
          </div>
        </div>

        {error && (
          <div className="login-message error">
            {error}
          </div>
        )}

        {success && (
          <div className="login-message success">
            <CheckCircle size={17} />

            <span>
              Login successful. Redirecting...
            </span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="login-email">
            Email Address
          </label>

          <input
            id="login-email"
            type="email"
            placeholder="Enter email address"
            value={email}
            disabled={loading}
            autoComplete="email"
            onChange={(e) =>
              setEmail(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleLogin();
              }
            }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="login-password">
            Password
          </label>

          <div className="password-box">
            <input
              id="login-password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Enter password"
              value={password}
              disabled={loading}
              autoComplete="current-password"
              onChange={(e) =>
                setPassword(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleLogin();
                }
              }}
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowPassword((prev) => !prev)
              }
              disabled={loading}
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>
        </div>

        <label className="remember-row">
          <input
            type="checkbox"
            checked={rememberMe}
            disabled={loading}
            onChange={(e) =>
              setRememberMe(e.target.checked)
            }
          />

          <span>Remember email</span>
        </label>

        <button
          type="button"
          className="login-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2
                size={18}
                className="spin"
              />

              <span>Signing in...</span>
            </>
          ) : (
            <>
              <LogIn size={18} />

              <span>Sign In</span>
            </>
          )}
        </button>

        <div className="login-footer">
          HiveSync v2.0 · La Union, Philippines · © 2026 BFATC
        </div>
      </div>
    </div>
  );
}

export default Login;
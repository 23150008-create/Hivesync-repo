import { useState } from "react";
import "../styles/login.css";

import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  LogOut,
  CircleCheck,
  Circle,
} from "lucide-react";

const API_BASE =
  "http://localhost/HiveSync/backend";

const DEFAULT_PASSWORD =
  "HiveSync@123";

function PasswordField({
  label,
  value,
  setValue,
  show,
  setShow,
  placeholder,
  loading,
  onEnter,
  strengthClass = "",
}) {
  return (
    <div className="form-group">
      <label>{label}</label>

      <div
        className={`password-box ${strengthClass}`}
      >
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          disabled={loading}
          onChange={(e) =>
            setValue(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onEnter();
            }
          }}
        />

        <button
          type="button"
          onClick={() =>
            setShow((current) => !current)
          }
          disabled={loading}
          aria-label={
            show
              ? "Hide password"
              : "Show password"
          }
        >
          {show ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
      </div>
    </div>
  );
}

function ChangePassword({
  user,
  onPasswordChanged,
  onLogout,
}) {
  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [showCurrent, setShowCurrent] =
    useState(false);

  const [showNew, setShowNew] =
    useState(false);

  const [showConfirm, setShowConfirm] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const passwordRules = [
    {
      label: "At least 8 characters",
      valid: newPassword.length >= 8,
    },
    {
      label: "Contains uppercase letter",
      valid: /[A-Z]/.test(newPassword),
    },
    {
      label: "Contains lowercase letter",
      valid: /[a-z]/.test(newPassword),
    },
    {
      label: "Contains number",
      valid: /[0-9]/.test(newPassword),
    },
    {
      label:
        "Contains special character",
      valid:
        /[^A-Za-z0-9]/.test(newPassword),
    },
  ];

  const passedRules =
    passwordRules.filter(
      (rule) => rule.valid
    ).length;

  const isPasswordValid =
    passedRules === passwordRules.length;

  const getPasswordStrength = () => {
    if (!newPassword) {
      return {
        label: "Password Strength",
        className: "empty",
        percent: 0,
      };
    }

    if (passedRules === 1) {
      return {
        label: "Weak",
        className: "weak",
        percent: 35,
      };
    }

    if (passedRules === 2) {
      return {
        label: "Medium",
        className: "medium",
        percent: 70,
      };
    }

    return {
      label: "Strong",
      className: "strong",
      percent: 100,
    };
  };

  const passwordStrength =
    getPasswordStrength();

  const handleChangePassword =
    async () => {
      if (loading) return;

      setError("");
      setSuccess("");

      if (
        !currentPassword ||
        !newPassword ||
        !confirmPassword
      ) {
        setError(
          "Please complete all password fields."
        );
        return;
      }

      if (!isPasswordValid) {
        setError(
          "New password must be at least 8 characters and contain uppercase, lowercase, number, and special character."
        );
        return;
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        setError(
          "New password and confirm password do not match."
        );
        return;
      }

      if (
        newPassword ===
        DEFAULT_PASSWORD
      ) {
        setError(
          "Please choose a password different from the default password."
        );
        return;
      }

      if (
        newPassword ===
        currentPassword
      ) {
        setError(
          "New password must be different from the current password."
        );
        return;
      }

      setLoading(true);

      try {
        const csrfRes = await fetch(
          `${API_BASE}/auth/csrf_token.php`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        const csrfData =
          await csrfRes.json();

        if (
          !csrfRes.ok ||
          !csrfData.success ||
          !csrfData.csrf_token
        ) {
          setError(
            csrfData.message ||
              "Unable to verify the security token."
          );

          setLoading(false);
          return;
        }

        const res = await fetch(
          `${API_BASE}/settings_management/change_password.php`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
              "X-CSRF-Token":
                csrfData.csrf_token,
            },
            body: JSON.stringify({
              current_password:
                currentPassword,
              new_password:
                newPassword,
              confirm_password:
                confirmPassword,
            }),
          }
        );

        const data =
          await res.json();

        if (!data.success) {
          setError(
            data.message ||
              "Password update failed."
          );

          setLoading(false);
          return;
        }

        setSuccess(
          "Password updated successfully. Please sign in again using your new password."
        );
        setTimeout(() => {
          onPasswordChanged({
            ...user,
            must_change_password: 0,
          });
        }, 1000);
      } catch (error) {
        console.log(
          "Change password error:",
          error
        );

        setError(
          "Cannot connect to backend. Please check Apache/XAMPP."
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
            <Lock size={42} />
          </div>

          <h1>
            Change Password
          </h1>

          <p>
            Welcome,{" "}
            {user?.full_name}.
            Please change your
            default password before
            continuing.
          </p>

          <div className="login-badge">
            <span>
              Default password must
              be replaced
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

            <span>{success}</span>
          </div>
        )}

        <PasswordField
          label="Current Password"
          value={currentPassword}
          setValue={
            setCurrentPassword
          }
          show={showCurrent}
          setShow={setShowCurrent}
          placeholder="Enter current password"
          loading={loading}
          onEnter={
            handleChangePassword
          }
        />

        <PasswordField
          label="New Password"
          value={newPassword}
          setValue={setNewPassword}
          show={showNew}
          setShow={setShowNew}
          placeholder="Enter new password"
          loading={loading}
          onEnter={
            handleChangePassword
          }
          strengthClass={`strength-${passwordStrength.className}`}
        />

        {newPassword && (
          <div className="password-strength-card">
            <div className="password-strength-head">
              <span>
                Password Strength
              </span>

              <strong
                className={`strength-text ${passwordStrength.className}`}
              >
                {
                  passwordStrength.label
                }
              </strong>
            </div>

            <div className="strength-bar">
              <div
                className={`strength-fill ${passwordStrength.className}`}
                style={{
                  width: `${passwordStrength.percent}%`,
                }}
              />
            </div>

            <div className="password-rule-list">
              {passwordRules.map(
                (rule) => (
                  <div
                    key={
                      rule.label
                    }
                    className={
                      rule.valid
                        ? "password-rule valid"
                        : "password-rule"
                    }
                  >
                    {rule.valid ? (
                      <CircleCheck
                        size={15}
                      />
                    ) : (
                      <Circle
                        size={15}
                      />
                    )}

                    <span>
                      {
                        rule.label
                      }
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        <PasswordField
          label="Confirm New Password"
          value={confirmPassword}
          setValue={
            setConfirmPassword
          }
          show={showConfirm}
          setShow={setShowConfirm}
          placeholder="Confirm new password"
          loading={loading}
          onEnter={
            handleChangePassword
          }
          strengthClass={
            confirmPassword
              ? newPassword ===
                confirmPassword
                ? "strength-strong"
                : "strength-weak"
              : ""
          }
        />

        <button
          className="login-btn"
          onClick={
            handleChangePassword
          }
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2
                size={18}
                className="spin"
              />
              Updating...
            </>
          ) : (
            <>
              <Lock size={18} />
              Update Password
            </>
          )}
        </button>

        <button
          className="login-secondary-btn"
          type="button"
          onClick={onLogout}
          disabled={loading}
        >
          <LogOut size={17} />
          Logout
        </button>

        <div className="login-footer">
          HiveSync v2.0 · La
          Union, Philippines · ©
          2026 BFATC
        </div>
      </div>
    </div>
  );
}

export default ChangePassword;
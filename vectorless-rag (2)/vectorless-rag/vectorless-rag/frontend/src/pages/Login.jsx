import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Login.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Login({ onLogin }) {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        if (onLogin) {
          await onLogin();
        }

        navigate("/");
      } else {
        setError(data.detail || "Login failed");
      }
    } catch {
      setError("Could not connect to server");
    }

    setLoading(false);
  };

  return (
    <div className="login-page" key={replayKey}>

      {/* Background glow */}
      <div className="bg-glow glow-one"></div>
      <div className="bg-glow glow-two"></div>

      {/* ================= TITLE ================= */}

      <div className="animation-title">
        <h1>Login Form</h1>
        <h2>Vectorless RAG Bot</h2>
      </div>

      {/* ================= SPEECH BUBBLE ================= */}

      <div className="speech-bubble">
        Wait a second! Let me grab the login form for you! 👋
      </div>

      {/* ================= CHARACTER ================= */}
      {/* Inline SVG so it never depends on a missing image file */}

      <div className="character">
        <svg viewBox="0 0 120 200" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="60" cy="185" rx="28" ry="8" fill="#000" opacity="0.35" />
          <rect x="38" y="95" width="44" height="70" rx="18" fill="#2b6fff" />
          <circle cx="60" cy="55" r="34" fill="#ffd9b3" />
          <path d="M28 50 a32 32 0 0 1 64 0 v6 h-64 z" fill="#1a1a2e" />
          <circle cx="47" cy="57" r="4" fill="#1a1a2e" />
          <circle cx="73" cy="57" r="4" fill="#1a1a2e" />
          <path d="M48 72 q12 10 24 0" stroke="#1a1a2e" strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="20" y="100" width="16" height="55" rx="8" fill="#ffd9b3" />
          <rect x="84" y="100" width="16" height="55" rx="8" fill="#ffd9b3" />
          <rect x="40" y="160" width="16" height="35" rx="7" fill="#11111d" />
          <rect x="64" y="160" width="16" height="35" rx="7" fill="#11111d" />
        </svg>
      </div>

      {/* ================= LOGIN FORM ================= */}

      <div className="login-animation-wrapper">

        <div className="login-card">

          {/* Logo */}
          <div className="logo-row">
            <div className="logo-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 8V4H8" />
                <rect
                  width="16"
                  height="12"
                  x="4"
                  y="8"
                  rx="2"
                />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
              </svg>
            </div>

            <span>RAG Bot</span>
          </div>

          {/* Heading */}
          <h2 className="login-title">
            Welcome Back
          </h2>

          <div className="title-line"></div>

          <p className="login-subtitle">
            Sign in to continue
          </p>

          {/* Error */}
          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="login-form"
          >

            {/* Username */}
            <div className="field-group">
              <label>
                Username
              </label>

              <div className="input-wrapper">
                <span className="input-icon">
                  👤
                </span>

                <input
                  name="username"
                  type="text"
                  placeholder="Enter your username"
                  value={form.username}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="field-group">
              <label>
                Password
              </label>

              <div className="input-wrapper">
                <span className="input-icon">
                  🔒
                </span>

                <input
                  type="password"
                  name="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="sign-in-button"
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Register */}
          <p className="register-text">
            Don't have an account?{" "}
            <Link to="/register">
              Register
            </Link>
          </p>

        </div>
      </div>

      {/* ================= REPLAY ================= */}

      {/* <button
        className="replay-button"
        onClick={() => setReplayKey((k) => k + 1)}
      >
        ↻ Replay Animation
      </button> */}

    </div>
  );
}

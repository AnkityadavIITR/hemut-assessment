"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
    general?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  const validateFieldWithXHR = (
    field: string,
    value: string
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.open("POST", "data:application/json;charset=utf-8,", true);
      xhr.setRequestHeader("Content-Type", "application/json");

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (field === "username") {
            if (!value || value.trim() === "") {
              resolve("Username is required");
            } else if (value.length < 3) {
              resolve("Username must be at least 3 characters");
            } else {
              resolve(null);
            }
          } else if (field === "password") {
            if (!value || value.trim() === "") {
              resolve("Password is required");
            } else if (value.length < 6) {
              resolve("Password must be at least 6 characters");
            } else {
              resolve(null);
            }
          }
        }
      };

      // Trigger the validation
      xhr.send(JSON.stringify({ field, value }));
    });
  };

  const validateAllFields = async (): Promise<boolean> => {
    const usernameError = await validateFieldWithXHR("username", username);
    const passwordError = await validateFieldWithXHR("password", password);

    setErrors({
      username: usernameError || undefined,
      password: passwordError || undefined,
    });

    return !usernameError && !passwordError;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    const isValid = await validateAllFields();
    if (!isValid) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ general: data.detail || "Login failed" });
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      router.push("/forum");
    } catch (error) {
      setErrors({ general: "Network error. Please try again." });
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Welcome Back</h1>
        <p>Sign in to access the Q&A Dashboard</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() =>
                validateFieldWithXHR("username", username).then((err) => {
                  if (err) setErrors((prev) => ({ ...prev, username: err }));
                })
              }
              className={errors.username ? "error" : ""}
              placeholder="Enter your username"
            />
            {errors.username && (
              <div className="error-message">{errors.username}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() =>
                validateFieldWithXHR("password", password).then((err) => {
                  if (err) setErrors((prev) => ({ ...prev, password: err }));
                })
              }
              className={errors.password ? "error" : ""}
              placeholder="Enter your password"
            />
            {errors.password && (
              <div className="error-message">{errors.password}</div>
            )}
          </div>

          {errors.general && (
            <div
              className="error-message"
              style={{ marginBottom: "15px", textAlign: "center" }}
            >
              {errors.general}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-link">
          Don't have an account? <Link href="/register">Sign up</Link>
        </div>

        <div className="auth-link" style={{ marginTop: "10px" }}>
          <Link href="/forum">Continue as Guest</Link>
        </div>

        <div
          style={{
            marginTop: "30px",
            padding: "15px",
            background: "#f0f0f0",
            borderRadius: "8px",
            fontSize: "13px",
          }}
        >
          <strong>Demo Credentials:</strong>
          <br />
          Username: admin
          <br />
          Password: admin123
        </div>
      </div>
    </div>
  );
}

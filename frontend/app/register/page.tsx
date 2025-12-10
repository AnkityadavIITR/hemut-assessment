'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  // XMLHttpRequest validation function
  const validateFieldWithXHR = (field: string, value: string, compareValue?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      // Use a dummy endpoint for validation (data URI)
      xhr.open('POST', 'data:application/json;charset=utf-8,', true);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (field === 'username') {
            if (!value || value.trim() === '') {
              resolve('Username is required');
            } else if (value.length < 3) {
              resolve('Username must be at least 3 characters');
            } else if (value.length > 50) {
              resolve('Username must be less than 50 characters');
            } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
              resolve('Username can only contain letters, numbers, and underscores');
            } else {
              resolve(null);
            }
          } else if (field === 'email') {
            if (!value || value.trim() === '') {
              resolve('Email is required');
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              resolve('Please enter a valid email address');
            } else {
              resolve(null);
            }
          } else if (field === 'password') {
            if (!value || value.trim() === '') {
              resolve('Password is required');
            } else if (value.length < 6) {
              resolve('Password must be at least 6 characters');
            } else if (value.length > 100) {
              resolve('Password must be less than 100 characters');
            } else {
              resolve(null);
            }
          } else if (field === 'confirmPassword') {
            if (!value || value.trim() === '') {
              resolve('Please confirm your password');
            } else if (value !== compareValue) {
              resolve('Passwords do not match');
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
    const usernameError = await validateFieldWithXHR('username', username);
    const emailError = await validateFieldWithXHR('email', email);
    const passwordError = await validateFieldWithXHR('password', password);
    const confirmPasswordError = await validateFieldWithXHR('confirmPassword', confirmPassword, password);

    setErrors({
      username: usernameError || undefined,
      email: emailError || undefined,
      password: passwordError || undefined,
      confirmPassword: confirmPasswordError || undefined,
    });

    return !usernameError && !emailError && !passwordError && !confirmPasswordError;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate using XMLHttpRequest
    const isValid = await validateAllFields();
    if (!isValid) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ general: data.detail || 'Registration failed' });
        setLoading(false);
        return;
      }

      // Store token and user data
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to forum
      router.push('/forum');
    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' });
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Create Account</h1>
        <p>Join our Q&A community today</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => validateFieldWithXHR('username', username).then(err => {
                if (err) setErrors(prev => ({ ...prev, username: err }));
              })}
              className={errors.username ? 'error' : ''}
              placeholder="Choose a username"
            />
            {errors.username && <div className="error-message">{errors.username}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => validateFieldWithXHR('email', email).then(err => {
                if (err) setErrors(prev => ({ ...prev, email: err }));
              })}
              className={errors.email ? 'error' : ''}
              placeholder="Enter your email"
            />
            {errors.email && <div className="error-message">{errors.email}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => validateFieldWithXHR('password', password).then(err => {
                if (err) setErrors(prev => ({ ...prev, password: err }));
              })}
              className={errors.password ? 'error' : ''}
              placeholder="Create a password"
            />
            {errors.password && <div className="error-message">{errors.password}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => validateFieldWithXHR('confirmPassword', confirmPassword, password).then(err => {
                if (err) setErrors(prev => ({ ...prev, confirmPassword: err }));
              })}
              className={errors.confirmPassword ? 'error' : ''}
              placeholder="Confirm your password"
            />
            {errors.confirmPassword && <div className="error-message">{errors.confirmPassword}</div>}
          </div>

          {errors.general && (
            <div className="error-message" style={{ marginBottom: '15px', textAlign: 'center' }}>
              {errors.general}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-link">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>

        <div className="auth-link" style={{ marginTop: '10px' }}>
          <Link href="/forum">Continue as Guest</Link>
        </div>
      </div>
    </div>
  );
}

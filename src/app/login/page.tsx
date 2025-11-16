"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import styles from './login.module.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, logout, isAuthenticated, isAdmin, userId } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    const result = await login(username.trim(), password.trim());
    setLoading(false);
    
    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const handleLogout = () => {
    logout();
    setUsername('');
    setPassword('');
    setError('');
  };

  if (isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>You are logged in</h1>
          <div className={styles.status}>
            <p className={styles.statusText}>
              User: <strong>{userId}</strong>
            </p>
            <p className={styles.statusText}>
              Role: <strong>{isAdmin ? 'Admin' : 'User'}</strong>
            </p>
          </div>
          <div className={styles.actions}>
            <button onClick={() => router.push('/')} className={styles.button}>
              Go to Home
            </button>
            <button onClick={handleLogout} className={styles.buttonSecondary}>
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Login</h1>
        <p className={styles.description}>
          Enter your credentials to authenticate with JWT tokens.
        </p>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.label}>
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.input}
              placeholder="Enter your username"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className={styles.info}>
          <h3 className={styles.infoTitle}>Default Credentials</h3>
          <ul className={styles.infoList}>
            <li><strong>Admin:</strong> username: admin, password: (set in .env)</li>
            <li><strong>User:</strong> username: user, password: (set in .env)</li>
            <li><strong>Anonymous:</strong> No login required, but limited to 10MB file sizes</li>
          </ul>
        </div>

        <div className={styles.note}>
          <strong>Note:</strong> This implementation uses JWT tokens. Configure your credentials in the .env file for security.
        </div>
      </div>
    </div>
  );
}

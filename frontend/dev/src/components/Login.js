import React, { useState } from 'react';
import './Login.css';

// Helper function to generate a unique ID
const generateUserId = () => {
  return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
};

const Login = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        setError('Server error. Please try again.');
        return;
      }

      if (response.ok) {
        // Store auth state and user info in localStorage for persistence
        localStorage.setItem('isAuthenticated', 'true');
        
        // Store user data
        if (data.user) {
          localStorage.setItem('userId', data.user.id);
          localStorage.setItem('userFirstName', data.user.firstName);
          localStorage.setItem('userLastName', data.user.lastName);
          localStorage.setItem('userEmail', data.user.email);
        } else {
          // Fallback to generated ID if no user data
          const generatedId = generateUserId();
          localStorage.setItem('userId', generatedId);
        }
        
        // Call the callback to update parent component state
        onLoginSuccess(localStorage.getItem('userId'));
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form-wrapper">
        <h1>Speech Transcription Login</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>
          
          <button 
            type="submit" 
            className="login-button" 
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
          
          <div className="login-help">
            <p>Demo account: a@firmament / 123456</p>
            <p>Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToRegister(); }}>Register</a></p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login; 
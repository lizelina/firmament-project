import React, { useState, useEffect } from 'react';
import './App.css';
import TranscriptionMic from './components/TranscriptionMic';
import Login from './components/Login';
import Register from './components/Register';

function App() {
  const [transcript, setTranscript] = useState('Realtime speech transcription API');
  const [status, setStatus] = useState('Click the microphone to start');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [showLogin, setShowLogin] = useState(true); // To toggle between login and register
  
  // Check if user is already authenticated
  useEffect(() => {
    const authenticated = localStorage.getItem('isAuthenticated') === 'true';
    const storedUserId = localStorage.getItem('userId');
    
    // Only consider authenticated if both auth flag and userId exist
    if (authenticated && storedUserId) {
      setIsAuthenticated(true);
      setUserId(storedUserId);
      
      // Fetch user info from localStorage
      setUserInfo({
        firstName: localStorage.getItem('userFirstName') || '',
        lastName: localStorage.getItem('userLastName') || '',
        email: localStorage.getItem('userEmail') || ''
      });
    } else if (authenticated && !storedUserId) {
      // If authenticated but no userId, force logout
      handleLogout();
    }
  }, []);

  const handleLoginSuccess = (userId) => {
    setIsAuthenticated(true);
    setUserId(userId);
    
    // Fetch user info from localStorage
    setUserInfo({
      firstName: localStorage.getItem('userFirstName') || '',
      lastName: localStorage.getItem('userLastName') || '',
      email: localStorage.getItem('userEmail') || ''
    });
  };

  const handleLogout = () => {
    // Clear all auth data
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userId');
    localStorage.removeItem('userFirstName');
    localStorage.removeItem('userLastName');
    localStorage.removeItem('userEmail');
    
    // Update state
    setIsAuthenticated(false);
    setUserId(null);
    setUserInfo(null);
    setShowLogin(true); // Go back to login screen on logout
  };
  
  // Show login/register page if not authenticated
  if (!isAuthenticated) {
    return showLogin ? 
      <Login 
        onLoginSuccess={handleLoginSuccess} 
        onSwitchToRegister={() => setShowLogin(false)} 
      /> : 
      <Register 
        onRegisterSuccess={handleLoginSuccess} 
        onSwitchToLogin={() => setShowLogin(true)} 
      />;
  }
  
  // Show transcription interface if authenticated
  return (
    <div className="App">
      <div className="container">
        <div className="header">
          <div className="header-title">
            <h1>Captions by Deepgram</h1>
            {userInfo && (
              <div className="user-info">
                Welcome, {userInfo.firstName} {userInfo.lastName}
              </div>
            )}
          </div>
          <button className="logout-button" onClick={handleLogout}>Logout</button>
        </div>
        <TranscriptionMic 
          onStatusChange={setStatus}
          onTranscriptChange={setTranscript}
          userId={userId}
        />
        <div className="status-message">{status}</div>
        <div className="transcript-container">
          <div className="transcript">{transcript}</div>
        </div>
      </div>
    </div>
  );
}

export default App;

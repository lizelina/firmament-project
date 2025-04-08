import React, { useState, useEffect } from 'react';
import './App.css';
import TranscriptionMic from './components/TranscriptionMic';
import Login from './components/Login';

function App() {
  const [transcript, setTranscript] = useState('Realtime speech transcription API');
  const [status, setStatus] = useState('Click the microphone to start');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);
  
  // Check if user is already authenticated and has userId
  useEffect(() => {
    const authenticated = localStorage.getItem('isAuthenticated') === 'true';
    const storedUserId = localStorage.getItem('userId');
    
    // Only consider authenticated if both auth flag and userId exist
    if (authenticated && storedUserId) {
      setIsAuthenticated(true);
      setUserId(storedUserId);
    } else if (authenticated && !storedUserId) {
      // If authenticated but no userId, force logout
      handleLogout();
    }
  }, []);

  const handleLoginSuccess = (userId) => {
    setIsAuthenticated(true);
    setUserId(userId);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userId');
    setIsAuthenticated(false);
    setUserId(null);
  };
  
  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }
  
  // Show transcription interface if authenticated
  return (
    <div className="App">
      <div className="container">
        <div className="header">
          <h1>Captions by Deepgram</h1>
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

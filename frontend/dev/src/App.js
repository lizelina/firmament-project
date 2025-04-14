import React, { useState, useEffect } from 'react';
import './App.css';
import TranscriptionMic from './components/TranscriptionMic';
import Login from './components/Login';
import Register from './components/Register';
import TranscriptList from './components/TranscriptList';
import TranscriptDetail from './components/TranscriptDetail';

function App() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [showLogin, setShowLogin] = useState(true);
  
  // Transcript states
  const [transcripts, setTranscripts] = useState([]);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'new', 'view'
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
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

      // Fetch transcripts from database
      fetchUserTranscripts(storedUserId);
    } else if (authenticated && !storedUserId) {
      // If authenticated but no userId, force logout
      handleLogout();
    }
  }, []);

  // Fetch user transcripts from the server
  const fetchUserTranscripts = async (userId) => {
    try {
      const response = await fetch(`http://localhost:8000/transcripts/${userId}`);
      
      if (!response.ok) {
        // Handle HTTP errors
        console.error(`Error fetching transcripts: HTTP ${response.status}`);
        return;
      }
      
      // Try to parse the JSON response
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        return;
      }
      
      if (data.success && Array.isArray(data.transcripts)) {
        setTranscripts(data.transcripts);
      } else {
        console.error('Failed to fetch transcripts:', data.message || 'Unknown error');
        // Initialize with empty array if no data
        setTranscripts([]);
      }
    } catch (error) {
      console.error('Error fetching transcripts:', error);
      // Initialize with empty array on error
      setTranscripts([]);
    }
  };

  const handleLoginSuccess = (userId) => {
    setIsAuthenticated(true);
    setUserId(userId);
    
    // Fetch user info from localStorage
    setUserInfo({
      firstName: localStorage.getItem('userFirstName') || '',
      lastName: localStorage.getItem('userLastName') || '',
      email: localStorage.getItem('userEmail') || ''
    });

    // Fetch transcripts from database
    fetchUserTranscripts(userId);
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
    setShowLogin(true);
    setTranscripts([]);
    setCurrentView('list');
    setSelectedTranscript(null);
  };

  const handleStartNewTranscription = () => {
    setCurrentView('new');
  };

  const handleViewTranscript = (transcriptId) => {
    const transcript = transcripts.find(t => t._id === transcriptId);
    if (transcript) {
      setSelectedTranscript(transcript);
      setCurrentView('view');
    }
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedTranscript(null);
  };

  const handleSaveTranscript = async (completeTranscript) => {
    // Only save if there's actual content
    if (!completeTranscript.text || completeTranscript.text.trim() === '') {
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Convert the transcript object to MongoDB format
      const transcriptData = {
        userId: userId,
        title: completeTranscript.title || `Note ${new Date().toLocaleDateString()}`,
        originalText: completeTranscript.text,
        date: completeTranscript.date, // Already in ISO format
        duration: completeTranscript.duration // Already in seconds
      };
      
      // Save to MongoDB
      const response = await fetch('http://localhost:8000/transcripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transcriptData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Fetch latest transcripts after successful save
        await fetchUserTranscripts(userId);
        
        // Add a small delay before navigating back to list
        setTimeout(() => {
          setCurrentView('list');
        }, 500);
      } else {
        console.error('Error saving transcript:', result.message);
      }
    } catch (error) {
      console.error('Error saving transcript:', error);
    } finally {
      setIsSaving(false);
    }
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
  
  // Show authenticated content
  return (
    <div className="App">
      <div className="app-header">
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

      <div className="app-content">
        {currentView === 'list' && (
          <TranscriptList 
            transcripts={transcripts}
            onStartNewTranscription={handleStartNewTranscription}
            onViewTranscript={handleViewTranscript}
          />
        )}
        
        {currentView === 'new' && (
          <TranscriptDetail
            isNewTranscription={true}
            userId={userId}
            onSaveTranscript={handleSaveTranscript}
            onBackToList={handleBackToList}
          />
        )}
        
        {currentView === 'view' && selectedTranscript && (
          <TranscriptDetail
            transcript={selectedTranscript}
            userId={userId}
            onBackToList={handleBackToList}
          />
        )}
      </div>
      
      {isSaving && (
        <div className="saving-indicator">
          <div className="saving-spinner"></div>
          <span>Saving transcript...</span>
        </div>
      )}
    </div>
  );
}

export default App;

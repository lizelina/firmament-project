import React, { useState, useEffect } from 'react';
import './App.css';
import TranscriptionMic from './components/TranscriptionMic';
import Login from './components/Login';
import Register from './components/Register';
import NoteList from './components/NoteList';
import NoteDetail from './components/NoteDetail';

function App() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [showLogin, setShowLogin] = useState(true);
  
  // Note states
  const [notes, setNotes] = useState([]);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'new', 'view'
  const [selectedNote, setSelectedNote] = useState(null);
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

      // Fetch notes from database
      fetchUserNotes(storedUserId);
    } else if (authenticated && !storedUserId) {
      // If authenticated but no userId, force logout
      handleLogout();
    }
  }, []);

  // Fetch user notes from the server
  const fetchUserNotes = async (userId) => {
    try {
      const response = await fetch(`http://localhost:8000/userdata/${userId}`);
      
      if (!response.ok) {
        // Handle HTTP errors
        console.error(`Error fetching notes: HTTP ${response.status}`);
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
      
      if (data.success && Array.isArray(data.notes)) {
        setNotes(data.notes);
      } else {
        console.error('Failed to fetch notes:', data.message || 'Unknown error');
        // Initialize with empty array if no data
        setNotes([]);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
      // Initialize with empty array on error
      setNotes([]);
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

    // Fetch notes from database
    fetchUserNotes(userId);
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
    setNotes([]);
    setCurrentView('list');
    setSelectedNote(null);
  };

  const handleStartNewNote = () => {
    setCurrentView('new');
  };

  const handleViewNote = (noteId) => {
    const note = notes.find(n => n._id === noteId);
    if (note) {
      setSelectedNote(note);
      setCurrentView('view');
    }
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedNote(null);
  };

  const handleSaveNote = async (noteData) => {
    if (!noteData.title) {
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Save to MongoDB using the userdata endpoint
      const response = await fetch('http://localhost:8000/userdata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Fetch latest notes after successful save
        await fetchUserNotes(userId);
        
        // Return success with the note ID
        return {
          success: true,
          noteId: result.noteId
        };
      } else {
        console.error('Error saving note:', result.message);
        throw new Error(result.message || 'Failed to save note');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      throw error;
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
          <h1>My Note App</h1>
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
          <NoteList 
            notes={notes}
            onStartNewNote={handleStartNewNote}
            onViewNote={handleViewNote}
          />
        )}
        
        {currentView === 'new' && (
          <NoteDetail
            isNewNote={true}
            userId={userId}
            onSaveNote={handleSaveNote}
            onBackToList={handleBackToList}
          />
        )}
        
        {currentView === 'view' && selectedNote && (
          <NoteDetail
            note={selectedNote}
            userId={userId}
            onSaveNote={handleSaveNote}
            onBackToList={handleBackToList}
          />
        )}
      </div>
      
      {isSaving && (
        <div className="saving-indicator">
          <div className="saving-spinner"></div>
          <span>Saving note...</span>
        </div>
      )}
    </div>
  );
}

export default App;

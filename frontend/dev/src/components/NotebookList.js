import React, { useState } from 'react';
import './NotebookList.css';

const NotebookList = ({ 
  transcripts: notebooks, 
  onStartNewTranscription: onStartNewNotebook, 
  onViewTranscript: onViewNotebook,
  onDeleteNotebook 
}) => {
  // State to track deletion in progress
  const [deletingId, setDeletingId] = useState(null);
  
  // Ensure notebooks is always an array
  const safeNotebooks = Array.isArray(notebooks) ? notebooks : [];
  
  // Handle delete button click
  const handleDelete = async (e, notebookId) => {
    e.stopPropagation(); // Prevent notebook click event
    
    if (!notebookId) return;
    
    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this notebook? This action cannot be undone.')) {
      return;
    }
    
    // Set the deleting status
    setDeletingId(notebookId);
    
    try {
      // Call the parent's delete function
      await onDeleteNotebook(notebookId);
      // No need to remove from local state, parent component will refresh the list
    } catch (error) {
      console.error('Error deleting notebook:', error);
      alert('Failed to delete notebook. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };
  
  return (
    <div className="notebook-list-container">
      <div className="notebook-list-header">
        <h2>Your Notebooks</h2>
        <button 
          className="new-notebook-button" 
          onClick={() => {
            console.log("New Notebook button clicked");
            onStartNewNotebook();
          }}
        >
          New Notebook
        </button>
      </div>
      
      {safeNotebooks.length > 0 ? (
        <div className="notebook-items">
          {safeNotebooks.map((notebook) => (
            <div 
              key={notebook._id || `notebook-${Math.random()}`} 
              className="notebook-list-item"
              onClick={() => onViewNotebook(notebook._id)}
            >
              <div className="notebook-list-item-header">
                <h3>{notebook.title || 'Untitled'}</h3>
                <span className="notebook-date">
                  {formatDate(notebook.createdAt || notebook.date)}
                </span>
              </div>
              <p className="notebook-preview">
                {((notebook.noteText || notebook.originalText || notebook.text || '').substring(0, 100))}
                {((notebook.noteText || notebook.originalText || notebook.text || '').length > 100 ? '...' : '')}
              </p>
              <div className="notebook-item-footer">
                <span className="notebook-duration">
                  Duration: {formatDuration(notebook.duration)}
                </span>
                
                <button 
                  className="delete-notebook-button" 
                  onClick={(e) => handleDelete(e, notebook._id)}
                  disabled={deletingId === notebook._id}
                  title="Delete notebook"
                >
                  {deletingId === notebook._id ? 
                    <span className="deleting-spinner"></span> : 
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3>No notebooks available</h3>
          <p>Click "New Notebook" to create your first notebook</p>
        </div>
      )}
    </div>
  );
};

// Format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown date';
  
  try {
    const date = new Date(dateStr);
    // Check if date is valid
    if (isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString();
  } catch (error) {
    return 'Unknown date';
  }
};

// Utility function to format duration in seconds to MM:SS
const formatDuration = (durationSeconds) => {
  if (durationSeconds === undefined || durationSeconds === null) return '';
  
  try {
    // If it's already a formatted string like "1:30", return it
    if (typeof durationSeconds === 'string' && durationSeconds.includes(':')) {
      return durationSeconds;
    }
    
    // Convert to number if it's a string
    const seconds = typeof durationSeconds === 'string' 
      ? parseInt(durationSeconds, 10) 
      : durationSeconds;
    
    // Check if conversion resulted in a valid number
    if (isNaN(seconds)) return '0:00';
    
    // Format as MM:SS
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('Error formatting duration:', error);
    return '0:00'; // Return default on error
  }
};

export default NotebookList; 
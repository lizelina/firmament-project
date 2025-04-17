import React from 'react';
import './NotebookList.css';

const NotebookList = ({ transcripts: notebooks, onStartNewTranscription: onStartNewNotebook, onViewTranscript: onViewNotebook }) => {
  // Ensure notebooks is always an array
  const safeNotebooks = Array.isArray(notebooks) ? notebooks : [];
  
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
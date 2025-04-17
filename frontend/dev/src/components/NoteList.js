// NoteList.js
// Should be safe to deprecate TranscriptList.js in favor of this component

import React from 'react';
import './NoteList.css';

const NoteList = ({ notes = [], onStartNewNote, onViewNote }) => {
  // Ensure transcripts is always an array
  const safeNotes = Array.isArray(notes) ? notes : [];

  return (
    <div className="note-list-container">
      <div className="note-list-header">
        <h2>Your Notes</h2>
        <button 
          className="new-note-button" 
          onClick={onStartNewNote}
        >
          New Note
        </button>
      </div>

      {safeNotes.length > 0 ? (
        <div className="note-items">
          {safeNotes.map((note) => (
            <div 
              key={note._id || `note-${Math.random()}`} 
              className="note-list-item"
              onClick={() => onViewNote(note._id)}
            >
              <div className="note-list-item-header">
                <h3>{note.title || 'Untitled Note'}</h3>
                <span className="note-date">
                  {formatDate(note.updatedAt || note.date)}
                </span>
              </div>
              <p className="note-preview">
                {(note.noteText || '').substring(0, 100)}
                {(note.noteText || '').length > 100 ? '...' : ''}
              </p>
              <div className="note-item-footer">
                {note.curTranscript && (
                  <span className="note-transcript-badge">
                    Has Transcription
                  </span>
                )}
                {note.curSummary && (
                  <span className="note-summary-badge">
                    AI Summary Available
                  </span>
                )}
                <span className="note-debug-id">
                  ID: {note._id || 'Unknown'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3>No notes available</h3>
          <p>Click "New Note" to create your first one</p>
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

export default NoteList;
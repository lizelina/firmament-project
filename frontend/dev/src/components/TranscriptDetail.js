import React, { useState, useEffect } from 'react';
import TranscriptionMic from './TranscriptionMic';
import './TranscriptDetail.css';

const TranscriptDetail = ({ 
  transcript, 
  userId, 
  onSaveTranscript, 
  onBackToList, 
  isNewTranscription = false 
}) => {
  const [isRecording, setIsRecording] = useState(isNewTranscription);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [status, setStatus] = useState(isNewTranscription ? 'Ready to record' : '');
  
  // Set initial transcript content if viewing an existing one
  useEffect(() => {
    if (!isNewTranscription && transcript) {
      const text = transcript?.originalText || transcript?.text || '';
      setCurrentTranscript(text);
    }
  }, [transcript, isNewTranscription]);

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus || 'Ready to record');
    
    // Update recording state based on status
    if (newStatus && (newStatus.includes('start') || newStatus.includes('recording'))) {
      setIsRecording(true);
    } else if (newStatus && (newStatus.includes('stop') || newStatus.includes('Click the microphone'))) {
      setIsRecording(false);
    }
  };

  const handleTranscriptChange = (newTranscript) => {
    setCurrentTranscript(newTranscript);
  };

  const handleCompleteTranscript = (completeTranscript) => {
    // When complete transcript is ready, send to parent component
    onSaveTranscript(completeTranscript);
  };

  return (
    <div className="transcript-detail-container">
      <div className="transcript-detail-header">
        <h2>{isNewTranscription ? 'New Transcription' : transcript?.title}</h2>
        
        {!isRecording && (
          <button 
            className="back-button" 
            onClick={onBackToList}
          >
            Back to Home
          </button>
        )}
      </div>
      
      {isNewTranscription && (
        <div className="transcription-toggle-container">
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={isRecording} 
              onChange={() => {
                // Only allow toggling on if currently off
                if (!isRecording) {
                  setIsRecording(true);
                }
                // Toggling off happens via the mic component
              }}
              disabled={isRecording} // Disable while recording
            />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">
            {isRecording ? 'Recording in progress' : 'Start Recording'}
          </span>
        </div>
      )}

      {/* Only show status message for new transcriptions */}
      {isNewTranscription && (
        <div className="status-message">{status}</div>
      )}
      
      {isNewTranscription ? (
        <div className="transcription-area">
          {isRecording && (
            <TranscriptionMic
              onStatusChange={handleStatusChange}
              onTranscriptChange={handleTranscriptChange}
              onCompleteTranscript={handleCompleteTranscript}
              userId={userId}
            />
          )}
          
          <div className="transcript-content">
            {currentTranscript || <span className="placeholder-text">Transcript will appear here...</span>}
          </div>
        </div>
      ) : (
        <div className="transcript-view">
          <div className="transcript-metadata">
            <div className="metadata-item">
              <span className="metadata-label">Date:</span>
              <span className="metadata-value">
                {formatDate(transcript?.createdAt || transcript?.date)}
              </span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Duration:</span>
              <span className="metadata-value">
                {formatDuration(transcript?.duration)}
              </span>
            </div>
          </div>
          
          <div className="transcript-text-content">
            {currentTranscript || <span className="placeholder-text">No transcript content available</span>}
          </div>
        </div>
      )}
    </div>
  );
};

// Utility function to format a date string or ISO date
const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown date';
  
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateStr; // Return the original string if parsing fails
  }
};

// Utility function to format duration in seconds to MM:SS
const formatDuration = (durationSeconds) => {
  if (durationSeconds === undefined || durationSeconds === null) return 'Unknown';
  
  try {
    // If it's already a formatted string like "1:30", return it
    if (typeof durationSeconds === 'string' && durationSeconds.includes(':')) {
      return durationSeconds;
    }
    
    // Convert to number if it's a string
    const seconds = typeof durationSeconds === 'string' 
      ? parseInt(durationSeconds, 10) 
      : durationSeconds;
    
    // Format as MM:SS
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('Error formatting duration:', error);
    return 'Unknown'; // Return as string if parsing fails
  }
};

export default TranscriptDetail; 
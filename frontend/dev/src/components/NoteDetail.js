import React, { useState, useEffect } from 'react';
import TranscriptionMic from './TranscriptionMic';
import './NoteDetail.css';

const NoteDetail = ({ 
  note, 
  userId, 
  onSaveNote, 
  onBackToList, 
  isNewNote = false
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [noteTitle, setNoteTitle] = useState(isNewNote ? `Note ${new Date().toLocaleString()}` : (note?.title || 'Untitled Note'));
  const [noteText, setNoteText] = useState('');
  const [status, setStatus] = useState('Ready to record');
  const [showSummaryButton, setShowSummaryButton] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noteId, setNoteId] = useState(note?._id || null);
  
  // Set initial note content if viewing an existing one
  useEffect(() => {
    if (!isNewNote && note) {
      setNoteTitle(note.title || 'Untitled Note');
      setNoteText(note.noteText || '');
      setNoteId(note._id);
      
      // If there's a saved transcript, load it
      if (note.curTranscript) {
        setCurrentTranscript(note.curTranscript);
        setShowSummaryButton(true);
      }
    }
  }, [note, isNewNote]);

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus || 'Ready to record');
    
    // Update recording state based on status
    if (newStatus && (newStatus.includes('start') || newStatus.includes('recording'))) {
      setIsRecording(true);
      setShowSummaryButton(false);
    } else if (newStatus && (newStatus.includes('stop') || newStatus.includes('Click the microphone'))) {
      setIsRecording(false);
      // Show the summary button after recording stops and we have transcript content
      if (currentTranscript && currentTranscript.trim() !== '') {
        setShowSummaryButton(true);
      }
    }
  };

  const handleTranscriptChange = (newTranscript) => {
    setCurrentTranscript(newTranscript);
  };

  const handleCompleteTranscript = (completeTranscript) => {
    // When complete transcript is ready, update current transcript
    if (completeTranscript && completeTranscript.text) {
      setCurrentTranscript(completeTranscript.text);
      setShowSummaryButton(true);
    }
  };

  const handleManualSave = () => {
    saveNote();
  };

  const handleGenerateSummary = () => {
    // Placeholder for AI summary functionality
    console.log('Generate AI summary of:', currentTranscript);
    // This would typically call an API endpoint that processes the transcript
  };

  const saveNote = async () => {
    setIsSaving(true);
    
    const noteData = {
      userId: userId,
      noteId: noteId, // Will be null for new notes
      title: noteTitle,
      noteText: noteText,
      curTranscript: currentTranscript,
      curSummary: '' // Currently empty as per requirements
    };
    
    try {
      // Call backend API to save the note
      const endpoint = noteId 
        ? `http://localhost:8000/userdata/${noteId}`
        : 'http://localhost:8000/userdata';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // If this was a new note, store the returned ID for future saves
        if (!noteId && result.noteId) {
          setNoteId(result.noteId);
        }
        
        console.log('Note saved successfully');
      } else {
        console.error('Error saving note:', result.message);
      }
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="note-detail-container">
      <div className="note-detail-header">
        <input 
          type="text"
          className="note-title-input"
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
          placeholder="Enter note title..."
        />
        
        <div className="note-controls">
          <button 
            className="home-button" 
            onClick={onBackToList}
          >
            Home
          </button>
          <button 
            className="save-button" 
            onClick={handleManualSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      
      <div className="note-content-layout">
        {/* Left side: Note editor */}
        <div className="note-editor-section">
          <textarea
            className="note-text-editor"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Start writing your notes here..."
          />
        </div>
        
        {/* Right side: Transcription */}
        <div className="transcription-section">
          <div className="transcription-header">
            <h3>Voice Transcription</h3>
            <div className="transcription-toggle">
              <button 
                className={`mic-button ${isRecording ? 'recording' : ''}`}
                onClick={() => {
                  if (!isRecording) {
                    setIsRecording(true);
                  }
                }}
                disabled={isRecording}
              >
                🎤
              </button>
              <span className="toggle-status">
                {isRecording ? 'Recording...' : 'Start Recording'}
              </span>
            </div>
          </div>
          
          <div className="status-message">{status}</div>
          
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
            
            {showSummaryButton && (
              <button 
                className="ai-summary-button"
                onClick={handleGenerateSummary}
              >
                Generate AI Summary
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteDetail;
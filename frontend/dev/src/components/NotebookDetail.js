import React, { useState, useEffect, useRef } from 'react';
import TranscriptionMic from './TranscriptionMic';
import './NotebookDetail.css';

const NotebookDetail = ({ 
  transcript, 
  userId, 
  onSaveTranscript, 
  onBackToList, 
  isNewTranscription = false
}) => {
  // Track both the current recording state and whether we ever had text
  const [isRecording, setIsRecording] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [hasTranscript, setHasTranscript] = useState(false);
  const [status, setStatus] = useState('');
  const [title, setTitle] = useState(isNewTranscription ? 'New Note' : transcript?.title || 'Untitled');
  const [activeTab, setActiveTab] = useState('transcript'); // 'transcript' or 'summary'
  
  // Flag to track if a transcript was just saved (to prevent double saves)
  const [recentlySaved, setRecentlySaved] = useState(false);
  const lastSavedNoteId = useRef(null);
  
  // Set initial note and transcript content if viewing an existing one
  useEffect(() => {
    if (!isNewTranscription && transcript) {
      const initialText = transcript?.noteText || transcript?.originalText || transcript?.text || '';
      const initialTranscript = transcript?.curTranscript || '';
      
      setNoteText(initialText);
      setTranscriptText(initialTranscript);
      setTitle(transcript?.title || 'Untitled');
      lastSavedNoteId.current = transcript?._id || null;
      
      // If there's transcript text, mark that we have a transcript
      if (initialTranscript && initialTranscript.trim() !== '') {
        setHasTranscript(true);
      }
      
      // Always start in transcript tab when viewing a notebook
      setActiveTab('transcript');
    }
  }, [transcript, isNewTranscription]);

  // Reset to transcript tab when recording state changes
  useEffect(() => {
    console.log("✅ Recording state changed:", isRecording);
    if (isRecording) {
      console.log("✅ Recording started - switching to transcript tab");
      setActiveTab('transcript');
    }
  }, [isRecording]);

  // Get current date and time formatted for display
  const getCurrentDateTime = () => {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric'
    });
    const time = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${date} at ${time}`;
  };

  const handleStatusChange = (newStatus) => {
    console.log("Status change:", newStatus);
    setStatus(newStatus || '');
    
    // Update recording state based on status
    if (newStatus && newStatus.includes('start recording')) {
      console.log("✅ Setting isRecording to TRUE - start recording detected");
      setIsRecording(true);
      // Force switch to transcript tab when recording starts
      setActiveTab('transcript');
      // Reset saved flag when starting new recording
      setRecentlySaved(false);
    } else if (newStatus && (
      newStatus.includes('stop') || 
      newStatus.includes('Click the microphone to start') || 
      newStatus.includes('disconnected')
    )) {
      console.log("✅ Setting isRecording to FALSE - stop/click/disconnect detected");
      setIsRecording(false);
    }
  };

  const handleTranscriptChange = (newTranscript, recordingStatus) => {
    console.log("Transcript updated:", { 
      textLength: newTranscript.length,
      recordingStatus,
      hasContent: newTranscript && newTranscript.trim().length > 0
    });
    
    // Always update the transcript text state
    setTranscriptText(newTranscript);
    
    // If we received transcript text, mark that we have a transcript
    if (newTranscript && newTranscript.trim() !== '') {
      if (!hasTranscript) {
        console.log("✅ Setting hasTranscript to TRUE");
        setHasTranscript(true);
      }
    }
    
    // Reset saved flag if text changed
    if (recentlySaved && newTranscript !== transcriptText) {
      setRecentlySaved(false);
    }
    
    // IMPORTANT: Always update recording state if provided
    if (recordingStatus !== undefined) {
      console.log("✅ Updating recording state from transcript:", recordingStatus);
      setIsRecording(recordingStatus);
    }
  };

  const handleCompleteTranscript = (completeTranscript) => {
    console.log("Complete transcript received:", {
      textLength: completeTranscript.text?.length || 0,
      stayOnPage: completeTranscript.stayOnPage
    });
  
    // When complete transcript is ready, prepare data for saving
    const notebookData = {
      userId: userId,
      noteId: lastSavedNoteId.current || transcript?._id || null,
      title: title || `Note ${new Date().toLocaleDateString()}`,
      noteText: noteText || '',
      originalText: noteText || '', // For compatibility 
      text: noteText || '', // For compatibility
      curTranscript: completeTranscript.text || '',
      curSummary: '',
      date: completeTranscript.date || new Date().toISOString(),
      duration: completeTranscript.duration || 0
    };
    
    // Determine if we should stay on the page after saving
    const shouldStayOnPage = true;
    
    // Mark as recently saved to prevent duplicate saves
    setRecentlySaved(true);
    
    // Send to parent component to save
    onSaveTranscript(notebookData, "Transcript saved successfully.", shouldStayOnPage).then(noteId => {
      if (noteId) {
        lastSavedNoteId.current = noteId;
      }
    });
  };

  const handleNoteChange = (e) => {
    // Reset saved flag when note text changes
    if (recentlySaved && e.target.value !== noteText) {
      setRecentlySaved(false);
    }
    setNoteText(e.target.value);
  };

  const handleTitleChange = (e) => {
    // Reset saved flag when title changes
    if (recentlySaved && e.target.value !== title) {
      setRecentlySaved(false);
    }
    setTitle(e.target.value);
  };

  const handleSaveNote = () => {
    // If we just saved from stopping the recording and haven't changed anything, skip the save
    if (recentlySaved && !isRecording) {
      // Just navigate back without saving again
      onBackToList();
      return;
    }
    
    // Save the current note without new transcription
    const notebookData = {
      userId: userId,
      noteId: lastSavedNoteId.current || transcript?._id || null,
      title: title || `Note ${new Date().toLocaleDateString()}`,
      noteText: noteText,
      originalText: noteText, // For compatibility
      text: noteText, // For compatibility
      curTranscript: isRecording ? '' : transcriptText || '', // Only include transcript if not recording
      curSummary: '',
      date: new Date().toISOString(),
      duration: transcript?.duration || 0 // No duration for manual save
    };
    
    if (!userId) {
      console.error("Cannot save note: No userId provided");
      alert("Cannot save note: No user ID provided");
      return;
    }
    
    // Add a user-friendly message based on recording state
    let successMessage = isRecording ? 
      "Note saved. Transcription still in progress and will be saved when complete." : 
      "Note and transcript saved successfully.";
    
    // Show a temporary saving indicator
    setStatus("Saving notebook...");
    
    // Mark as recently saved
    setRecentlySaved(true);
    
    // Force stayOnPage to be false to ensure navigation
    onSaveTranscript(notebookData, successMessage, false).then(noteId => {
      if (noteId) {
        lastSavedNoteId.current = noteId;
      }
    });
  };
  
  // IMPORTANT: Check if we should show the summary tab
  // Only show when:
  // 1. Not recording
  // 2. Has transcript text
  const shouldShowSummaryTab = !isRecording && hasTranscript && transcriptText.trim() !== '';
  
  // Handle tab change - only allow switching to summary when not recording
  const handleTabChange = (tab) => {
    if (tab === 'summary' && isRecording) {
      return; // Don't allow switching to summary during recording
    }
    
    // Only allow summary tab if we have a transcript and not recording
    if (tab === 'summary' && (!hasTranscript || transcriptText.trim() === '')) {
      return; // Don't allow switching without transcript
    }
    
    setActiveTab(tab);
  };

  return (
    <div className="notebook-detail-container">
      {/* Header row with title and navigation */}
      <div className="notebook-header">
        <div className="notebook-title-section">
          <input 
            type="text" 
            className="notebook-title-input"
            value={title}
            onChange={handleTitleChange}
            placeholder="Enter notebook title"
          />
          <div className="notebook-date">{getCurrentDateTime()}</div>
        </div>
        
        <div className="notebook-actions">
          <button 
            className="home-button" 
            onClick={onBackToList}
            disabled={isRecording}
          >
            Home
          </button>
          
          <button 
            className="save-button" 
            onClick={handleSaveNote}
            disabled={isRecording}
          >
            Save
          </button>
        </div>
      </div>
      
      {/* Main content area with two columns */}
      <div className="notebook-content">
        {/* Left column - Note taking area */}
        <div className="note-column">
          <textarea
            className="note-textarea"
            value={noteText}
            onChange={handleNoteChange}
            placeholder="Start typing your notes here..."
          />
        </div>
        
        {/* Right column - Transcription/Summary area */}
        <div className="transcription-column">
          {/* Microphone component */}
          <div className="microphone-container">
            <TranscriptionMic
              onStatusChange={handleStatusChange}
              onTranscriptChange={handleTranscriptChange}
              onCompleteTranscript={handleCompleteTranscript}
              userId={userId}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
            />
            {status && (
              <div className="transcription-status">{status}</div>
            )}
          </div>
          
          {/* Tabs for Transcript and Summary */}
          <div className="transcription-tabs">
            <div 
              className={`tab ${activeTab === 'transcript' ? 'active' : ''}`}
              onClick={() => handleTabChange('transcript')}
            >
              Transcript
              {isRecording && <span className="recording-indicator"></span>}
            </div>
            
            {/* Only show the summary tab when NOT recording and we have transcript content */}
            {shouldShowSummaryTab ? (
              <div 
                className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => handleTabChange('summary')}
              >
                Summary
              </div>
            ) : (
              hasTranscript && !isRecording && (
                <div className="tab disabled">
                  Summary (Waiting for transcript)
                </div>
              )
            )}
          </div>
          
          {/* Transcription/Summary display area */}
          <div className="tab-content">
            {activeTab === 'transcript' && (
              <div className="transcription-text">
                {transcriptText || <span className="placeholder-text">Transcript will appear here...</span>}
              </div>
            )}
            
            {activeTab === 'summary' && !isRecording && (
              <div className="summary-text">
                <span className="placeholder-text">Summary will appear here...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotebookDetail;
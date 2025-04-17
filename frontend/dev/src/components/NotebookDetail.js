import React, { useState, useEffect, useRef } from 'react';
import TranscriptionMic from './TranscriptionMic';
import { GEMINI_API_KEY } from '../config/api-keys';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { motion, AnimatePresence } from 'framer-motion';
import './NotebookDetail.css';

// Initialize the Generative AI model
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Animation variants
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } }
};

const tabVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.3 } }
};

const NotebookDetail = ({ 
  notebook, 
  userId, 
  onSaveNotebook, 
  onBackToList, 
  isNewNotebook = false 
}) => {

  // Track both the current recording state and whether we ever had text
  const [isRecording, setIsRecording] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptDuration, setTranscriptDuration] = useState(0);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [status, setStatus] = useState('');
  const [title, setTitle] = useState(isNewNotebook ? 'New Note' : notebook?.title || 'Untitled');
  const [activeTab, setActiveTab] = useState('transcript'); // 'transcript' or 'summary'
  
  // Flag to track if a transcript was just saved (to prevent double saves)
  const [recentlySaved, setRecentlySaved] = useState(false);
  const lastSavedNoteId = useRef(null);
  
  // Summary and keywords state
  const [summaryText, setSummaryText] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  
  // State for copy button feedback
  const [copyFeedback, setCopyFeedback] = useState({ type: '', message: '' });
  
  // State for title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef(null);
  
  // Track recording start time
  const recordingStartTimeRef = useRef(null);
  
  // Consistent timeout for status messages
  const STATUS_TIMEOUT = 2000;

  // Unified entrance to save the notebook
  const saveNotebook = async (context = '') => {
    // Don't save if user ID is missing
    if (!userId) {
      console.error("Cannot save note: No userId provided");
      setStatus(`Error: No user ID provided`);
      setTimeout(() => setStatus(""), STATUS_TIMEOUT);
      return null;
    }
    
    // Prepare the notebook data
    const notebookData = {
      userId: userId,
      noteId: lastSavedNoteId.current || notebook?._id || null,
      title: title || `Note ${new Date().toLocaleDateString()}`,
      noteText: noteText || '',
      curTranscript: transcriptText || '',
      curSummary: summaryText ? JSON.stringify({
        summary: summaryText,
        keywords: keywords || []
      }) : '',
      date: new Date().toISOString(),
      duration: transcriptDuration || notebook?.duration || 0
    };

    // Show saving status with context if provided
    setStatus(`Saving${context ? ' ' + context : ''}...`);
    
    try {
      // Mark as recently saved to prevent duplicate saves
      setRecentlySaved(true);
      
      // Send to parent component to save
      const noteId = await onSaveNotebook(notebookData);
      
      if (noteId) {
        lastSavedNoteId.current = noteId;
        setStatus(`Saved${context ? ' ' + context : ''} successfully`);
        setTimeout(() => setStatus(""), STATUS_TIMEOUT);
        return noteId;
      } else {
        throw new Error("Failed to get note ID from save operation");
      }
    } catch (error) {
      console.error(`Error saving${context ? ' ' + context : ''}:`, error);
      setStatus(`Error saving${context ? ' ' + context : ''}: ${error.message || 'Unknown error'}`);
      setTimeout(() => setStatus(""), STATUS_TIMEOUT);
      return null;
    }
  };
  
  // Set initial note and transcript content if viewing an existing one
  useEffect(() => {
    if (!isNewNotebook && notebook) {
      const initialText = notebook?.noteText || notebook?.originalText || notebook?.text || '';
      const initialTranscript = notebook?.curTranscript || '';
      const initialDuration = notebook?.duration || 0;
      
      setNoteText(initialText);
      setTranscriptText(initialTranscript);
      setTranscriptDuration(initialDuration);
      setTitle(notebook?.title || 'Untitled');
      lastSavedNoteId.current = notebook?._id || null;
      
      // If there's transcript text, mark that we have a transcript
      if (initialTranscript && initialTranscript.trim() !== '') {
        setHasTranscript(true);
      }
      
      // Load existing summary and keywords if available
      if (notebook?.curSummary) {
        try {
          const summaryData = JSON.parse(notebook.curSummary);
          setSummaryText(summaryData.summary || '');
          setKeywords(summaryData.keywords || []);
        } catch (e) {
          // If it's not JSON, treat it as just summary text
          setSummaryText(notebook.curSummary);
        }
      }
      
      // Always start in transcript tab when viewing a notebook
      setActiveTab('transcript');
    }
  }, [notebook, isNewNotebook]);

  // Reset to transcript tab when recording state changes
  useEffect(() => {
    console.log("🎙️ [NotebookDetail] Recording state changed:", isRecording);
    if (isRecording) {
      console.log("🔴 [NotebookDetail] Recording started - switching to transcript tab");
      setActiveTab('transcript');
      
      // Reset summary and keywords when starting a new recording
      setSummaryText('');
      setKeywords([]);
      
      // If we have a note ID, clear the summary in the database
      if (lastSavedNoteId.current) {
        // Clear summary
        saveNotebook('cleared summary');
      }
      
      // Set start time when recording begins
      recordingStartTimeRef.current = new Date();
      console.log("📊 [NotebookDetail] Recording started, setting start time:", recordingStartTimeRef.current);
    } else {
      console.log("⏹️ [NotebookDetail] Recording stopped");
      
      // Calculate duration when recording stops
      if (recordingStartTimeRef.current) {
        const endTime = new Date();
        const durationSeconds = Math.round((endTime - recordingStartTimeRef.current) / 1000);
        setTranscriptDuration(durationSeconds);
        console.log(`📊 [NotebookDetail] Recording ended, duration: ${durationSeconds} seconds`);
      }
    }
  }, [isRecording]);
  
  // Generate summary and keywords when switching to summary tab
  useEffect(() => {
    if (activeTab === 'summary' && transcriptText.length > 100 && !summaryText && !isSummaryLoading) {
      generateSummaryAndKeywords();
    }
  }, [activeTab, transcriptText, summaryText, isSummaryLoading]);

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

  // Generate summary and keywords using Gemini Flash API
  const generateSummaryAndKeywords = async () => {
    if (transcriptText.length <= 100) {
      setSummaryError('Transcript is too short to generate a summary.');
      return;
    }
    
    setIsSummaryLoading(true);
    setSummaryError('');
    
    try {
      // Create the prompts for summary and keywords
      const summaryPrompt = `Summarize the following transcript in 3-4 clear sentences that capture the main points:
                    
                     "${transcriptText}"
                     
                     Summary:`;
      
      const keywordsPrompt = `Extract 5-7 important keywords or key phrases from this transcript. Return just the keywords separated by commas, without numbering or explanation:
                    
                     "${transcriptText}"
                     
                     Keywords:`;
      
      // Run both API calls in parallel for better performance
      const [summaryResponse, keywordsResponse] = await Promise.all([
        model.generateContent(summaryPrompt),
        model.generateContent(keywordsPrompt)
      ]);
      
      // Extract results from responses
      const summaryResult = summaryResponse.response.text().trim();
      const keywordsResult = keywordsResponse.response.text().trim();
      
      // Process the keywords into an array and clean up
      const keywordsList = keywordsResult
        .split(',')
        .map(keyword => keyword.trim())
        .filter(keyword => keyword.length > 0);
      
      setSummaryText(summaryResult);
      setKeywords(keywordsList);
      
      // Automatically save the summary data
      if (lastSavedNoteId.current) {
        console.log("Automatically saving summary and keywords");
        saveNotebook('summary');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummaryError('Failed to generate summary: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleStatusChange = (newStatus) => {
    console.log("ℹ️ [NotebookDetail] Status change:", newStatus);
    setStatus(newStatus || '');
    
    // Update recording state based on status
    if (newStatus && newStatus.includes('start recording')) {
      console.log("🔴 [NotebookDetail] Setting isRecording to TRUE - start recording detected");
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
      console.log("⏹️ [NotebookDetail] Setting isRecording to FALSE - stop/click/disconnect detected");
      setIsRecording(false);
    }
  };

  const handleTranscriptChange = (newTranscript, recordingStatus) => {
    console.log("📝 [NotebookDetail] Transcript updated:", { 
      textLength: newTranscript.length,
      recordingStatus,
      hasContent: newTranscript && newTranscript.trim().length > 0,
      currentRecordingState: isRecording
    });
    
    // Always update the transcript text state
    setTranscriptText(newTranscript);
    
    // If we received transcript text, mark that we have a transcript
    if (newTranscript && newTranscript.trim() !== '') {
      if (!hasTranscript) {
        console.log("✅ [NotebookDetail] Setting hasTranscript to TRUE");
        setHasTranscript(true);
      }
    }
    
    // Reset saved flag if text changed
    if (recentlySaved && newTranscript !== transcriptText) {
      setRecentlySaved(false);
    }
    
    // IMPORTANT: Only update recording state if explicitly provided and different
    // AND only if it's transitioning from true to false (stopping recording)
    // Don't allow transcript updates to start recording automatically
    if (recordingStatus === false && isRecording === true) {
      console.log(`🔄 [NotebookDetail] Stopping recording based on update from TranscriptionMic`);
      setIsRecording(false);
    } else if (recordingStatus !== undefined) {
      console.log(`ℹ️ [NotebookDetail] Received recording status ${recordingStatus}, current is ${isRecording} - not changing`);
    }
  };

  const handleCompleteTranscript = (completeTranscript) => {
    console.log("Complete transcript received:", {
      textLength: completeTranscript.text?.length || 0,
      stayOnPage: completeTranscript.stayOnPage,
      duration: completeTranscript.duration || 0
    });
  
    // Don't save if there's no content
    if (!completeTranscript.text || completeTranscript.text.trim() === '') {
      console.log("Nothing to save - transcript is empty");
      return;
    }
    
    // Reset recording start time reference
    recordingStartTimeRef.current = null;
    
    // When complete transcript is ready, update state variables
    setTranscriptText(completeTranscript.text || '');
    setTranscriptDuration(completeTranscript.duration || calculateCurrentDuration() || 0);
    
    // Log the duration being saved
    console.log(`📊 [NotebookDetail] Saving transcript with duration: ${completeTranscript.duration || calculateCurrentDuration() || 0} seconds`);
    
    // Mark as recently saved to prevent duplicate saves
    setRecentlySaved(true);
    
    // Save the notebook with context
    saveNotebook('transcript');
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
  
  // Handle title edit mode
  const startEditingTitle = () => {
    setIsEditingTitle(true);
    // Focus the input after state update
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
      }
    }, 10);
  };
  
  // Handle title save on blur
  const handleTitleBlur = async () => {
    setIsEditingTitle(false);
    
    // Don't save if title is empty, revert to previous or default title
    if (!title.trim()) {
      setTitle(notebook?.title || 'Untitled');
      return;
    }
    
    // If we don't have a note ID yet or title hasn't changed, don't save
    if (!lastSavedNoteId.current || title === notebook?.title) {
      return;
    }
    
    // Save the notebook with title context
    saveNotebook('title');
  };
  
  // Handle keyboard events on title input
  const handleTitleKeyDown = (e) => {
    // Save on Enter key
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur(); // Trigger blur to save
    }
    // Cancel on Escape key
    if (e.key === 'Escape') {
      e.preventDefault();
      setTitle(notebook?.title || 'Untitled');
      setIsEditingTitle(false);
    }
  };

  // Calculate current duration in seconds
  const calculateCurrentDuration = () => {
    if (!recordingStartTimeRef.current) {
      // Use existing duration if available
      return notebook?.duration || 0;
    }
    
    // Calculate elapsed time since recording started
    const now = new Date();
    const durationSeconds = Math.round((now - recordingStartTimeRef.current) / 1000);
    console.log(`📊 [NotebookDetail] Current duration: ${durationSeconds} seconds`);
    return durationSeconds;
  };
  
  const handleManualSave = async () => {
    // If we just saved from stopping the recording and haven't changed anything, skip the save
    if (recentlySaved && !isRecording) {
      return;
    }
    
    // Save the current note
    saveNotebook('notebook');
  };

  // Handle going back to the list - forcibly stop recording
  const handleBackToList = async () => {
    // If currently recording, force stop first
    if (isRecording) {
      // Force stop recording via TranscriptionMic
      setIsRecording(false);
      
      // Show status while stopping
      setStatus("Stopping recording...");
      
      // Small delay to allow TranscriptionMic to properly close connections
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Save the notebook before navigating away
    saveNotebook('before home');

    // Navigate back to the list without saving
    onBackToList();
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
  
  // Regenerate summary and keywords if desired
  const handleRegenerateSummary = () => {
    setSummaryText('');
    setKeywords([]);
    setIsSummaryLoading(false);
    setSummaryError('');
    // Setting these to empty will trigger the useEffect to regenerate
  };

  // Function to handle copying text to clipboard
  const handleCopy = async (text, type) => {
    if (!text) {
      setCopyFeedback({ type, message: 'Nothing to copy' });
      setTimeout(() => setCopyFeedback({ type: '', message: '' }), 2000);
      return;
    }
    
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback({ type, message: 'Copied to clipboard!' });
      setTimeout(() => setCopyFeedback({ type: '', message: '' }), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setCopyFeedback({ type, message: 'Failed to copy' });
      setTimeout(() => setCopyFeedback({ type: '', message: '' }), 2000);
    }
  };

  // Function to open Perplexity AI with a keyword in the context of the summary
  const openPerplexityWithKeyword = (keyword) => {
    if (!keyword) return;
    
    // Create a query that includes the keyword and summary context
    let query = `Explain the concept of "${keyword}"`;
    
    // Add summary context if available
    if (summaryText && summaryText.trim().length > 0) {
      query += ` in the context of: "${summaryText.trim()}"`;
    }
    
    // URL encode the query
    const encodedQuery = encodeURIComponent(query);
    
    // Create Perplexity URL with the query
    const perplexityUrl = `https://www.perplexity.ai/search?q=${encodedQuery}`;
    
    // Open in a new browser tab
    window.open(perplexityUrl, '_blank');
  };

  return (
    <motion.div 
      className="notebook-detail-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header row with title and navigation */}
      <div className="notebook-header">
        <motion.div 
          className="notebook-title-section"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          {isEditingTitle ? (
            <input 
              ref={titleInputRef}
              type="text" 
              className="notebook-title-input editing"
              value={title}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              placeholder="Enter notebook title"
            />
          ) : (
            <h2 
              className="notebook-title-display"
              onClick={startEditingTitle}
              title="Click to edit title"
            >
              {title}
            </h2>
          )}
          <div className="notebook-date">{getCurrentDateTime()}</div>
        </motion.div>
        
        <motion.div 
          className="notebook-actions"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <button 
            className="home-button" 
            onClick={handleBackToList}
          >
            Home
          </button>
          
          <button 
            className="save-button" 
            onClick={handleManualSave}
          >
            Save
          </button>
        </motion.div>
      </div>
      
      {/* Main content area with two columns */}
      <motion.div 
        className="notebook-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        {/* Left column - Note taking area */}
        <motion.div 
          className="note-column"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <textarea
            className="note-textarea"
            value={noteText}
            onChange={handleNoteChange}
            placeholder="Start typing your notes here..."
          />
        </motion.div>
        
        {/* Right column - Transcription/Summary area */}
        <motion.div 
          className="transcription-column"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {/* Microphone component */}
          <motion.div 
            className="microphone-container"
            whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(0, 0, 0, 0.1)" }}
            transition={{ duration: 0.2 }}
          >
            <TranscriptionMic
              onStatusChange={handleStatusChange}
              onTranscriptChange={handleTranscriptChange}
              onCompleteTranscript={handleCompleteTranscript}
              userId={userId}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
            />
            {status && (
              <motion.div 
                className="transcription-status"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                key={status}
              >
                {status}
              </motion.div>
            )}
          </motion.div>
          
          {/* Tabs for Transcript and Summary */}
          <div className="transcription-tabs">
            <motion.div 
              className={`tab ${activeTab === 'transcript' ? 'active' : ''}`}
              onClick={() => handleTabChange('transcript')}
              whileHover={activeTab !== 'transcript' ? { y: -2 } : {}}
              whileTap={{ scale: 0.98 }}
            >
              Transcript
              {isRecording && <span className="recording-indicator"></span>}
            </motion.div>
            
            {/* Only show the summary tab when NOT recording and we have transcript content */}
            {shouldShowSummaryTab ? (
              <motion.div 
                className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => handleTabChange('summary')}
                whileHover={activeTab !== 'summary' ? { y: -2 } : {}}
                whileTap={{ scale: 0.98 }}
              >
                Summary
              </motion.div>
            ) : (
              hasTranscript && !isRecording && (
                <div className="tab disabled">
                  Summary (Waiting for transcript)
                </div>
              )
            )}
          </div>
          
          {/* Transcription/Summary display area */}
          <motion.div 
            className="tab-content"
            layout
            transition={{ duration: 0.3 }}
          >
            <AnimatePresence mode="wait">
              {activeTab === 'transcript' && (
                <motion.div 
                  className="transcription-text-container"
                  key="transcript"
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <div className="transcription-header">
                    <h3>Transcript</h3>
                    <motion.button 
                      className="copy-button"
                      onClick={() => handleCopy(transcriptText, 'transcript')}
                      disabled={!transcriptText}
                      title="Copy transcript to clipboard"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      {copyFeedback.type === 'transcript' && (
                        <motion.span 
                          className="copy-feedback"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                        >
                          {copyFeedback.message}
                        </motion.span>
                      )}
                    </motion.button>
                  </div>
                  <div className="transcription-text">
                    {transcriptText || <span className="placeholder-text">Transcript will appear here...</span>}
                  </div>
                </motion.div>
              )}
              
              {activeTab === 'summary' && !isRecording && (
                <motion.div 
                  className="summary-content"
                  key="summary"
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  {isSummaryLoading ? (
                    <motion.div 
                      className="summary-loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.div 
                        className="spinner"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      />
                      <p>Generating summary and keywords with Gemini AI...</p>
                    </motion.div>
                  ) : summaryError ? (
                    <motion.div 
                      className="summary-error"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <p>{summaryError}</p>
                      <motion.button 
                        onClick={handleRegenerateSummary}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Try Again
                      </motion.button>
                    </motion.div>
                  ) : (
                    <>
                      {keywords && keywords.length > 0 && (
                        <motion.div 
                          className="keywords-section"
                          variants={tabVariants}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: 0.1 }}
                        >
                          <div className="section-header">
                            <h3>Keywords</h3>
                            <motion.button 
                              className="copy-button"
                              onClick={() => handleCopy(keywords.join(', '), 'keywords')}
                              disabled={!keywords.length}
                              title="Copy keywords to clipboard"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                              {copyFeedback.type === 'keywords' && (
                                <motion.span 
                                  className="copy-feedback"
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0 }}
                                >
                                  {copyFeedback.message}
                                </motion.span>
                              )}
                            </motion.button>
                          </div>
                          <div className="keywords-list">
                            {keywords.map((keyword, index) => (
                              <motion.button 
                                key={index} 
                                className="keyword-tag clickable"
                                onClick={() => openPerplexityWithKeyword(keyword)}
                                title={`Click to search for "${keyword}" on Perplexity AI`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.05 * index }}
                                whileHover={{ 
                                  y: -4, 
                                  boxShadow: "0 6px 10px rgba(80, 86, 224, 0.2)" 
                                }}
                                whileTap={{ y: 0, boxShadow: "none" }}
                              >
                                {keyword}
                                <span className="keyword-icon">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                  </svg>
                                </span>
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                      
                      <motion.div 
                        className="summary-section"
                        variants={tabVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: 0.2 }}
                      >
                        <div className="section-header">
                          <h3>Summary</h3>
                          <motion.button 
                            className="copy-button"
                            onClick={() => handleCopy(summaryText, 'summary')}
                            disabled={!summaryText}
                            title="Copy summary to clipboard"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            {copyFeedback.type === 'summary' && (
                              <motion.span 
                                className="copy-feedback"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                              >
                                {copyFeedback.message}
                              </motion.span>
                            )}
                          </motion.button>
                        </div>
                        <div className="summary-text">
                          {summaryText || <span className="placeholder-text">No summary available. Click "Generate" to create one.</span>}
                        </div>
                      </motion.div>
                      
                      <motion.div 
                        className="summary-actions"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        <motion.button 
                          onClick={handleRegenerateSummary}
                          className="regenerate-button"
                          whileHover={{ y: -2, boxShadow: "0 6px 12px rgba(80, 86, 224, 0.25)" }}
                          whileTap={{ y: 0, boxShadow: "0 2px 4px rgba(80, 86, 224, 0.15)" }}
                        >
                          Regenerate
                        </motion.button>
                      </motion.div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default NotebookDetail;
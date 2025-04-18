import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './NotebookList.css';

const NotebookList = ({ 
  notebooks, 
  onStartNewNotebook, 
  onViewNotebook,
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
    <motion.div 
      className="notebook-list-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="notebook-list-header">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          Your Notebooks
        </motion.h2>
        
        <motion.button 
          className="new-notebook-button" 
          onClick={() => {
            console.log("New Notebook button clicked");
            onStartNewNotebook();
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          whileHover={{ y: -2, boxShadow: "0 6px 12px rgba(80, 86, 224, 0.25)" }}
          whileTap={{ y: 0 }}
        >
          New Notebook
        </motion.button>
      </div>
      
      {safeNotebooks.length > 0 ? (
        <motion.div 
          className="notebook-items"
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <AnimatePresence>
            {safeNotebooks.map((notebook, index) => (
              <motion.div 
                key={notebook._id || `notebook-${Math.random()}`} 
                className="notebook-list-item"
                onClick={() => onViewNotebook(notebook._id)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index, duration: 0.4 }}
                exit={{ opacity: 0, y: -10 }}
                whileHover={{ y: -3, boxShadow: "0 8px 20px rgba(0, 0, 0, 0.1)" }}
              >
                <div className="notebook-list-item-header">
                  <h3>{notebook.title || 'Untitled'}</h3>
                  <span className="notebook-date">
                    {formatDate(notebook.createdAt || notebook.date)}
                  </span>
                </div>
                <p className="notebook-preview">
                  {((notebook.noteText || '').substring(0, 100))}
                  {((notebook.noteText || '').length > 100 ? '...' : '')}
                </p>
                <div className="notebook-item-footer">
                  {notebook.curTranscript && notebook.curTranscript.trim() !== '' && (
                    <span className="notebook-duration">
                      Duration: {formatDuration(notebook.duration)}
                    </span>
                  )}
                  
                  <div className="footer-spacer"></div>
                  
                  <motion.button 
                    className="delete-notebook-button" 
                    onClick={(e) => handleDelete(e, notebook._id)}
                    disabled={deletingId === notebook._id}
                    title="Delete notebook"
                    whileHover={{ scale: 1.1, backgroundColor: "rgba(220, 53, 69, 0.1)" }}
                    whileTap={{ scale: 0.95 }}
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
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div 
          className="empty-state"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <motion.div 
            className="empty-state-icon"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            📝
          </motion.div>
          <h3>No notebooks available</h3>
          <p>Click "New Notebook" to create your first notebook</p>
        </motion.div>
      )}
    </motion.div>
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
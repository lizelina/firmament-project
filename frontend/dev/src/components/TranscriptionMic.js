import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './TranscriptionMic.css';

// Helper function to generate ephemeral session ID
const generateEphemeralId = (baseUserId) => {
  const randomPart = Math.random().toString(36).substring(2, 6);
  const timestampPart = Date.now().toString().slice(-6);
  
  let prefix = '';
  if (baseUserId) {
    const shortBaseId = baseUserId.length > 4 ? baseUserId.substring(0, 4) : baseUserId;
    prefix = `${shortBaseId}_`;
  }
  
  return `${prefix}${randomPart}${timestampPart}`;
};

// Format current date and time
const formatDateTime = () => {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const time = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
  return { date, time };
};

const TranscriptionMic = ({ 
  onStatusChange, 
  onTranscriptChange, 
  userId, 
  onCompleteTranscript,
  isRecording,
  setIsRecording
}) => {
  // Internal recording state
  const [recording, setRecording] = useState(false);
  const [connected, setConnected] = useState(false);
  const [deepgramConnected, setDeepgramConnected] = useState(false);
  const socketRef = useRef(null);
  const microphoneRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const ephemeralUserIdRef = useRef(null);
  const accumulatedTranscriptRef = useRef('');
  const startTimeRef = useRef(null);
  const MAX_RECONNECT_ATTEMPTS = 5;
  
  // Helper function for debug logging
  const debugLog = (...args) => {
    console.log("TranscriptionMic:", ...args);
  };

  // When recording state changes, notify the parent
  useEffect(() => {
    debugLog("Recording state is now:", recording);
  }, [recording]);

  // Respond to changes in isRecording prop from parent
  useEffect(() => {
    // If parent sets isRecording to false while we're recording, forcibly stop
    if (isRecording === false && recording === true) {
      debugLog("Parent forced recording stop");
      stopRecording(false); // Not silent
    }
    // If parent sets isRecording to true while we're not recording, start
    else if (isRecording === true && recording === false) {
      debugLog("Parent initiated recording start");
      startRecording();
    }
  }, [isRecording]);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Clean up socket if it exists
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Clean up media resources
      stopAndReleaseMediaResources();
      
      // Clear ephemeral user ID
      ephemeralUserIdRef.current = null;
    };
  }, []);

  // Safely update transcript while preserving recording state
  const updateTranscript = (transcriptText) => {
    // Only update if there's content
    if (transcriptText && transcriptText.trim() !== '') {
      // Append to accumulated transcript
      const currentTranscript = accumulatedTranscriptRef.current;
      // Add spacing if needed
      const spacer = currentTranscript && !currentTranscript.endsWith(' ') ? ' ' : '';
      const newTranscript = currentTranscript + spacer + transcriptText;
      
      // Update our local reference
      accumulatedTranscriptRef.current = newTranscript;
      
      // Send to parent WITH CURRENT RECORDING STATE
      if (onTranscriptChange) {
        // IMPORTANT: Always send the current recording state with the transcript
        debugLog("Sending transcript with recording state:", recording);
        onTranscriptChange(newTranscript, recording);
      }
    }
  };

  // Initialize a fresh socket connection with a new ephemeral ID
  const initializeSocket = (ephemeralUserId) => {
    return new Promise((resolve, reject) => {
      // Ensure we have an ephemeral user ID
      if (!ephemeralUserId) {
        reject(new Error("No ephemeral userId provided"));
        return;
      }

      // Clean up existing socket if any
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const socketPort = 5001;
      const socketUrl = `http://localhost:${socketPort}`;
      
      const socket = io(socketUrl, {
        query: { userId: ephemeralUserId }, // Use ephemeral ID in query params
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        withCredentials: false
      });

      // Connection status events
      socket.on('connect', () => {
        reconnectAttemptsRef.current = 0;
        setConnected(true);
        onStatusChange("Socket connected. Starting transcription...");
        resolve(socket); // Resolve the promise when connected
      });

      socket.on('disconnect', () => {
        setConnected(false);
        setDeepgramConnected(false);
        onStatusChange("Socket disconnected. Stopping recording...");
        
        if (recording) {
          stopRecording(true);
        }
      });

      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reconnectAttemptsRef.current++;
        onStatusChange(`Error connecting to server: ${error.message}. Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`);
        
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          onStatusChange("Could not connect to server. Please try again later.");
          reject(new Error(`Connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts`));
        }
      });

      socket.on('reconnect', (attemptNumber) => {
        onStatusChange("Reconnected to server. Continuing transcription...");
      });

      // Deepgram event listeners
      socket.on('deepgram_ready', (data) => {
        setDeepgramConnected(true);
        onStatusChange("Listening... Speak now");
      });

      socket.on('deepgram_stopped', (data) => {
        setDeepgramConnected(false);
        
        if (recording) {
          stopRecording(true);
        }
        
        onStatusChange("Transcription stopped");
      });

      socket.on('deepgram_disconnected', (data) => {
        setDeepgramConnected(false);
        if (recording) {
          stopRecording(true);
          onStatusChange("Deepgram disconnected. Please try again.");
        }
      });

      socket.on('deepgram_error', (data) => {
        console.error('Deepgram error:', data);
        onStatusChange("Error with speech service: " + data.error);
      });

      socket.on('connection_lost', (data) => {
        console.error('Connection lost:', data);
        setDeepgramConnected(false);
        onStatusChange(data.message);
        
        if (recording) {
          stopRecording(true);
        }
      });

      socket.on('connection_error', (data) => {
        console.error('Connection error:', data);
        onStatusChange(data.message);
      });

      // Handle socket transcription updates
      socket.on("transcription_update", (data) => {
        if (data.transcription && data.transcription.trim() !== '') {
          // IMPORTANT: Always update the transcript, regardless of recording state
          // This ensures we don't miss any data from the speech service
          debugLog(`Received transcript update: "${data.transcription}" (recording: ${recording})`);
          
          // Append to accumulated transcript
          const currentTranscript = accumulatedTranscriptRef.current;
          // Add spacing if needed
          const spacer = currentTranscript && !currentTranscript.endsWith(' ') ? ' ' : '';
          accumulatedTranscriptRef.current = currentTranscript + spacer + data.transcription;
          
          // Always update the transcript in the parent, KEEP CURRENT RECORDING STATE
          if (onTranscriptChange) {
            onTranscriptChange(accumulatedTranscriptRef.current, recording);
          }
        }
      });

      // Store socket in ref
      socketRef.current = socket;
      
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (!socket.connected) {
          reject(new Error("Socket connection timed out"));
        }
      }, 10000); // 10 second timeout
      
      // Clear timeout if connected
      socket.on('connect', () => {
        clearTimeout(connectionTimeout);
      });
    });
  };

  // Get microphone access
  const getMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,       // Mono audio (required by Deepgram)
          sampleRate: 16000,     // 16 kHz sample rate (optimal for speech recognition)
          echoCancellation: true, // Improve audio quality
          noiseSuppression: true  // Improve audio quality
        } 
      });
      
      // Store the MediaStream in the ref
      mediaStreamRef.current = stream;
      
      // Prioritize formats known to work well with Deepgram
      let mimeType = '';
      const preferredFormats = [
        'audio/webm;codecs=opus', // Best option for speech
        'audio/webm',
        'audio/ogg;codecs=opus'
      ];
      
      for (const format of preferredFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          break;
        }
      }
      
      // Create MediaRecorder with optimized settings
      const recorder = new MediaRecorder(stream, { 
        mimeType: mimeType,
        audioBitsPerSecond: 16000  // 16 kbps audio for speech is sufficient
      });
      
      return recorder;
    } catch (error) {
      console.error("Error accessing microphone:", error);
      onStatusChange("Error accessing microphone: " + error.message);
      throw error;
    }
  };

  // Helper function to fully stop and release resources
  const stopAndReleaseMediaResources = () => {
    return new Promise((resolve) => {
      // If there's no current recorder or it's already inactive, resolve immediately
      if (!microphoneRef.current || microphoneRef.current.state === 'inactive') {
        // Still release any stream that might be around
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => {
            track.stop();
          });
          mediaStreamRef.current = null;
        }
        
        resolve();
        return;
      }
      
      // Set up the onstop handler to release resources after stopping
      const originalOnStop = microphoneRef.current.onstop;
      
      microphoneRef.current.onstop = () => {
        // Call the original onstop if it exists
        if (originalOnStop) {
          originalOnStop.call(microphoneRef.current);
        }
        
        // Release all tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => {
            track.stop();
          });
          mediaStreamRef.current = null;
        }
        
        // Clear recorder
        microphoneRef.current = null;
        
        // Clean up UI
        document.body.classList.remove("recording");
        
        // Now we're fully done
        resolve();
      };
      
      // Trigger the stop
      try {
        microphoneRef.current.stop();
      } catch (error) {
        console.error("Error stopping recorder:", error);
        // Still try to clean up
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
        microphoneRef.current = null;
        document.body.classList.remove("recording");
        resolve();
      }
    });
  };

  // Open microphone and start recording
  const openMicrophone = async (microphone, socket) => {
    return new Promise((resolve) => {
      microphone.onstart = () => {
        document.body.classList.add("recording");
        resolve();
      };
      
      let packetCount = 0;
      let totalBytes = 0;
      
      microphone.ondataavailable = async (event) => {
        if (event.data.size > 0 && socket && socket.connected) {
          packetCount++;
          totalBytes += event.data.size;
          
          try {
            // Convert Blob to ArrayBuffer
            const arrayBuffer = await event.data.arrayBuffer();
            
            // Always include the current ephemeral userId with audio data
            const currentEphemeralId = ephemeralUserIdRef.current;
            if (currentEphemeralId) {
              socket.emit("audio_stream", {
                audio: arrayBuffer,
                userId: currentEphemeralId
              });
            }
          } catch (error) {
            console.error("Error processing audio data:", error);
          }
        }
      };
      
      microphone.onstop = () => {
        setRecording(false);
        
        // Update parent's recording state
        if (setIsRecording) {
          setIsRecording(false);
        }
      };
      
      microphone.onerror = (event) => {
        console.error("Microphone error:", event.error);
        setRecording(false);
        
        // Update parent's recording state
        if (setIsRecording) {
          setIsRecording(false);
        }
        
        onStatusChange("Microphone error: " + event.error);
      };
      
      // Use a smaller interval (250ms) for more frequent data chunks
      // This helps with real-time transcription
      microphone.start(250);
    });
  };

  // Start recording
  const startRecording = async () => {
    try {
      debugLog("Starting recording process");
      
      // First, ensure any existing recording is fully stopped
      onStatusChange("Preparing microphone...");
      await stopAndReleaseMediaResources();
      
      // Reset accumulated transcript
      accumulatedTranscriptRef.current = '';
      
      // IMPORTANT: Set recording state to true BEFORE starting the recording process
      setRecording(true);
      
      // Update parent's recording state
      if (setIsRecording) {
        setIsRecording(true);
      }
      
      // Notify parent component immediately with empty transcript
      if (onTranscriptChange) {
        debugLog("Notifying parent that recording is starting with empty transcript");
        onTranscriptChange('', true); // true = recording is active
      }
      
      // Save start time
      startTimeRef.current = new Date();
      
      // Generate a new ephemeral user ID for this recording session
      const newEphemeralUserId = generateEphemeralId(userId);
      ephemeralUserIdRef.current = newEphemeralUserId;
      
      // Initialize a fresh socket connection with the new ephemeral ID
      onStatusChange("Connecting to server...");
      await initializeSocket(newEphemeralUserId);
      
      onStatusChange("Initializing microphone...");
      
      // Get a fresh microphone instance
      microphoneRef.current = await getMicrophone();
      await openMicrophone(microphoneRef.current, socketRef.current);
      onStatusChange("Connecting to Deepgram...");
      
      // Only if socket is connected
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("toggle_transcription", { 
          action: "start",
          userId: newEphemeralUserId
        });
      } else {
        throw new Error("Socket not connected, can't start transcription");
      }
    } catch (error) {
      debugLog("Error starting recording:", error);
      setRecording(false);
      
      // Update parent's recording state
      if (setIsRecording) {
        setIsRecording(false);
      }
      
      // Notify parent of the error and recording state change
      if (onTranscriptChange) {
        onTranscriptChange(accumulatedTranscriptRef.current, false); // false = recording stopped
      }
      
      onStatusChange("Error starting recording: " + error.message);
      
      // Make sure resources are released if there's an error
      await stopAndReleaseMediaResources();
      
      // Also disconnect socket if it exists
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Clear ephemeral user ID
      ephemeralUserIdRef.current = null;
    }
  };

  // Stop recording
  const stopRecording = async (silent = false) => {
    if (recording) {
      debugLog("Stopping recording process");
      const isUserInitiated = !silent;
      
      // Get the current ephemeral user ID
      const currentEphemeralId = ephemeralUserIdRef.current;
      
      // First, signal the server to stop transcription
      if (!silent && socketRef.current && socketRef.current.connected && currentEphemeralId) {
        socketRef.current.emit("toggle_transcription", { 
          action: "stop",
          userId: currentEphemeralId
        });
      }
      
      // IMPORTANT: Set recording state to false BEFORE stopping the recording process
      setRecording(false);
      
      // Update parent's recording state
      if (setIsRecording) {
        setIsRecording(false);
      }
      
      // Notify parent component immediately
      if (onTranscriptChange) {
        onTranscriptChange(accumulatedTranscriptRef.current, false); // false = recording stopped
      }
      
      // Notify parent with status change that recording has stopped
      onStatusChange("Click the microphone to start");
      
      // Get end time and format timestamps
      const endTime = new Date();
      const { date, time } = formatDateTime();
      const duration = Math.round((endTime - startTimeRef.current) / 1000); // Duration in seconds
      
      // Create the complete transcript with metadata for database storage
      const completeTranscript = {
        text: accumulatedTranscriptRef.current,
        date: endTime.toISOString(), // ISO format for database
        time: time,
        title: `Note ${date} ${time}`,
        duration: duration, // Store as seconds for database
        durationStr: `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`, // For display
        userId,
        stayOnPage: true,
        toggleAction: isUserInitiated ? "user_stopped" : "system_stopped"
      };
      
      // Send complete transcript to parent component if there's content
      if (onCompleteTranscript && accumulatedTranscriptRef.current.trim() !== '') {
        onCompleteTranscript(completeTranscript);
      }
      
      // Stop the recorder and release all media resources
      await stopAndReleaseMediaResources();
      
      // Disconnect socket after stopping
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Clear the ephemeral user ID
      ephemeralUserIdRef.current = null;
    }
  };

  // Toggle recording state
  const toggleRecording = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Update the useEffect for socket message handling
  useEffect(() => {
    // Check if socketRef.current exists before accessing it
    if (!socketRef.current) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'transcript') {
          // ALWAYS pass the transcript to the parent, regardless of local recording state
          console.log("📝 Transcript received:", { text: data.text.substring(0, 20) + "...", isRecording: recording });
          onTranscriptChange(data.text, recording);
        }
      } catch (error) {
        console.error("Error handling message:", error);
      }
    };

    socketRef.current.onmessage = handleMessage;
    
    return () => {
      // Make sure socketRef.current still exists in cleanup
      if (socketRef.current) {
        socketRef.current.onmessage = null;
      }
    };
  }, [recording, onTranscriptChange]);

  return (
    <div className="mic-container">
      <div className="button-container">
        <button 
          className={`mic-button ${recording ? 'recording' : ''}`}
          onClick={toggleRecording}
          disabled={recording && !connected} // Only disable during recording if not connected
        >
          <div className={`mic ${recording ? 'active' : ''}`}>
            {recording && <div className="mic-loading-ring"></div>}
          </div>
          <div className="button-label">
            {recording ? 'STOP' : 'START'}
          </div>
        </button>
      </div>
    </div>
  );
};

export default TranscriptionMic; 
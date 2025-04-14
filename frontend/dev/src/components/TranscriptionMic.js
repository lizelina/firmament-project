import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './TranscriptionMic.css';

// Set to true to enable detailed console logging
const DEBUG = true;

// Helper function to generate ephemeral session ID
const generateEphemeralId = (baseUserId) => {
  // Use a shorter random part (4 chars)
  const randomPart = Math.random().toString(36).substring(2, 6);
  
  // Use abbreviated timestamp (last 6 digits only)
  const timestampPart = Date.now().toString().slice(-6);
  
  // If base userId exists, use just the first 4 chars
  let prefix = '';
  if (baseUserId) {
    // Take first 4 characters of baseUserId or the whole thing if it's shorter
    const shortBaseId = baseUserId.length > 4 ? baseUserId.substring(0, 4) : baseUserId;
    prefix = `${shortBaseId}_`;
  }
  
  // Create a compact session ID
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

const TranscriptionMic = ({ onStatusChange, onTranscriptChange, userId, onCompleteTranscript }) => {
  const [recording, setRecording] = useState(false);
  const [connected, setConnected] = useState(false);
  const [deepgramConnected, setDeepgramConnected] = useState(false);
  const socketRef = useRef(null);
  const microphoneRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const ephemeralUserIdRef = useRef(null); // Store current ephemeral ID
  const accumulatedTranscriptRef = useRef(''); // Store accumulated transcript
  const startTimeRef = useRef(null); // Store start time
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Helper function for debug logging
  const debugLog = (...args) => {
    if (DEBUG) {
      console.log(...args);
    }
  };

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Clean up socket if it exists
      if (socketRef.current) {
        debugLog('Component unmounting, cleaning up socket');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Clean up media resources
      stopAndReleaseMediaResources();
      
      // Clear ephemeral user ID
      ephemeralUserIdRef.current = null;
    };
  }, []);

  // Initialize a fresh socket connection with a new ephemeral ID
  const initializeSocket = (ephemeralUserId) => {
    return new Promise((resolve, reject) => {
      // Ensure we have an ephemeral user ID
      if (!ephemeralUserId) {
        debugLog('No ephemeral userId provided');
        reject(new Error("No ephemeral userId provided"));
        return;
      }

      // Clean up existing socket if any
      if (socketRef.current) {
        debugLog('Cleaning up existing socket connection');
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const socketPort = 5001;
      const socketUrl = `http://localhost:${socketPort}`;
      
      debugLog('Creating new socket connection to:', socketUrl, 'with ephemeral userId:', ephemeralUserId);
      
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
        debugLog('Connected to socket server with ephemeral userId:', ephemeralUserId);
        reconnectAttemptsRef.current = 0;
        setConnected(true);
        onStatusChange("Socket connected. Starting transcription...");
        resolve(socket); // Resolve the promise when connected
      });

      socket.on('disconnect', () => {
        debugLog('Disconnected from socket server');
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
        debugLog(`Reconnected on attempt ${attemptNumber}`);
        onStatusChange("Reconnected to server. Continuing transcription...");
      });

      // Deepgram event listeners
      socket.on('deepgram_ready', (data) => {
        debugLog('Deepgram connection ready:', data);
        setDeepgramConnected(true);
        onStatusChange("Listening... Speak now");
      });

      socket.on('deepgram_stopped', (data) => {
        debugLog('Deepgram stopped:', data);
        setDeepgramConnected(false);
        
        if (recording) {
          stopRecording(true);
        }
        
        onStatusChange("Transcription stopped");
      });

      socket.on('deepgram_disconnected', (data) => {
        debugLog('Deepgram disconnected:', data);
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

      socket.on("transcription_update", (data) => {
        if (data.transcription && data.transcription.trim() !== '') {
          debugLog("Received transcription:", data.transcription);
          
          // Append to accumulated transcript
          const currentTranscript = accumulatedTranscriptRef.current;
          // Add spacing if needed
          const spacer = currentTranscript && !currentTranscript.endsWith(' ') ? ' ' : '';
          accumulatedTranscriptRef.current = currentTranscript + spacer + data.transcription;
          
          // Update the display
          onTranscriptChange(accumulatedTranscriptRef.current);
        }
      });

      // Store socket in ref
      socketRef.current = socket;
      
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (!socket.connected) {
          debugLog('Socket connection timed out');
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
      debugLog("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,       // Mono audio (required by Deepgram)
          sampleRate: 16000,     // 16 kHz sample rate (optimal for speech recognition)
          echoCancellation: true, // Improve audio quality
          noiseSuppression: true  // Improve audio quality
        } 
      });
      debugLog("Microphone access granted", stream);
      
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
      
      debugLog("Using MIME type:", mimeType);
      
      // Create MediaRecorder with optimized settings
      const recorder = new MediaRecorder(stream, { 
        mimeType: mimeType,
        audioBitsPerSecond: 16000  // 16 kbps audio for speech is sufficient
      });
      
      debugLog("MediaRecorder created:", {
        mimeType: recorder.mimeType,
        state: recorder.state,
        audioBitsPerSecond: recorder.audioBitsPerSecond
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
        debugLog("No active recorder to stop");
        
        // Still release any stream that might be around
        if (mediaStreamRef.current) {
          debugLog("Releasing MediaStream tracks");
          mediaStreamRef.current.getTracks().forEach(track => {
            track.stop();
            debugLog(`Track ${track.id} stopped`);
          });
          mediaStreamRef.current = null;
        }
        
        resolve();
        return;
      }
      
      debugLog("Stopping active recorder...");
      
      // Set up the onstop handler to release resources after stopping
      const originalOnStop = microphoneRef.current.onstop;
      
      microphoneRef.current.onstop = () => {
        // Call the original onstop if it exists
        if (originalOnStop) {
          originalOnStop.call(microphoneRef.current);
        }
        
        debugLog("Recorder stopped, now releasing MediaStream tracks");
        
        // Release all tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => {
            track.stop();
            debugLog(`Track ${track.id} stopped`);
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
        debugLog("Client: Microphone opened");
        document.body.classList.add("recording");
        resolve();
      };
      
      let packetCount = 0;
      let totalBytes = 0;
      
      microphone.ondataavailable = async (event) => {
        if (event.data.size > 0 && socket && socket.connected) {
          packetCount++;
          totalBytes += event.data.size;
          
          if (packetCount % 10 === 0) {
            debugLog(`Audio stats: ${packetCount} packets, ${(totalBytes/1024).toFixed(2)} KB total`);
          }
          
          try {
            // Convert Blob to ArrayBuffer
            const arrayBuffer = await event.data.arrayBuffer();
            
            // Always include the current ephemeral userId with audio data
            const currentEphemeralId = ephemeralUserIdRef.current;
            if (currentEphemeralId) {
              debugLog(`Sending audio packet: size=${arrayBuffer.byteLength} bytes, ephemeralUserId=${currentEphemeralId}`);
              
              socket.emit("audio_stream", {
                audio: arrayBuffer,
                userId: currentEphemeralId
              });
            } else {
              debugLog("No ephemeral userId available, skipping audio packet");
            }
          } catch (error) {
            console.error("Error processing audio data:", error);
          }
        }
      };
      
      microphone.onstop = () => {
        debugLog("MediaRecorder stopped");
        setRecording(false);
      };
      
      microphone.onerror = (event) => {
        console.error("Microphone error:", event.error);
        setRecording(false);
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
      // First, ensure any existing recording is fully stopped
      onStatusChange("Preparing microphone...");
      await stopAndReleaseMediaResources();
      
      // Reset accumulated transcript
      accumulatedTranscriptRef.current = '';
      onTranscriptChange('');
      
      // Save start time
      startTimeRef.current = new Date();
      
      // Generate a new ephemeral user ID for this recording session
      const newEphemeralUserId = generateEphemeralId(userId);
      ephemeralUserIdRef.current = newEphemeralUserId;
      debugLog("Generated new ephemeral userId:", newEphemeralUserId);
      
      // Initialize a fresh socket connection with the new ephemeral ID
      onStatusChange("Connecting to server...");
      await initializeSocket(newEphemeralUserId);
      
      setRecording(true);
      onStatusChange("Initializing microphone...");
      
      // Get a fresh microphone instance
      microphoneRef.current = await getMicrophone();
      debugLog("Client: Waiting to open microphone");
      await openMicrophone(microphoneRef.current, socketRef.current);
      onStatusChange("Connecting to Deepgram...");
      
      // Only if socket is connected
      if (socketRef.current && socketRef.current.connected) {
        debugLog("Emitting toggle_transcription start event with ephemeral userId:", newEphemeralUserId);
        socketRef.current.emit("toggle_transcription", { 
          action: "start",
          userId: newEphemeralUserId
        });
      } else {
        throw new Error("Socket not connected, can't start transcription");
      }
    } catch (error) {
      setRecording(false);
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
      debugLog("Stopping microphone and releasing resources");
      
      // Get the current ephemeral user ID
      const currentEphemeralId = ephemeralUserIdRef.current;
      
      // First, signal the server to stop transcription
      if (!silent && socketRef.current && socketRef.current.connected && currentEphemeralId) {
        debugLog("Sending stop signal to server with ephemeral userId:", currentEphemeralId);
        socketRef.current.emit("toggle_transcription", { 
          action: "stop",
          userId: currentEphemeralId
        });
      }
      
      // Set recording state to false immediately
      setRecording(false);
      
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
        userId
      };
      
      // Send complete transcript to parent component if there's content
      if (onCompleteTranscript && accumulatedTranscriptRef.current.trim() !== '') {
        onCompleteTranscript(completeTranscript);
      }
      
      // Stop the recorder and release all media resources
      await stopAndReleaseMediaResources();
      
      // Disconnect socket after stopping
      if (socketRef.current) {
        debugLog("Disconnecting socket");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Clear the ephemeral user ID
      ephemeralUserIdRef.current = null;
      
      onStatusChange("Click the microphone to start");
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
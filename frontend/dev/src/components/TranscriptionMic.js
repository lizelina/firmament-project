import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './TranscriptionMic.css';

// Set to true to enable detailed console logging
const DEBUG = true;

const TranscriptionMic = ({ onStatusChange, onTranscriptChange }) => {
  const [recording, setRecording] = useState(false);
  const [connected, setConnected] = useState(false);
  const [deepgramConnected, setDeepgramConnected] = useState(false);
  const socketRef = useRef(null);
  const microphoneRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Helper function for debug logging
  const debugLog = (...args) => {
    if (DEBUG) {
      console.log(...args);
    }
  };

  // Initialize socket connection
  useEffect(() => {
    const socketPort = 5001;
    const socketUrl = `http://localhost:${socketPort}`;
    
    debugLog('Connecting to socket server:', socketUrl);
    
    socketRef.current = io(socketUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: false
    });

    // Connection status events
    socketRef.current.on('connect', () => {
      debugLog('Connected to socket server');
      reconnectAttemptsRef.current = 0;
      setConnected(true);
      onStatusChange("Socket connected. Click the microphone to start.");
    });

    socketRef.current.on('disconnect', () => {
      debugLog('Disconnected from socket server');
      setConnected(false);
      setDeepgramConnected(false);
      onStatusChange("Socket disconnected. Attempting to reconnect...");
      
      if (recording) {
        stopRecording(true);
      }
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Connection error:', error);
      reconnectAttemptsRef.current++;
      onStatusChange(`Error connecting to server: ${error.message}. Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`);
      
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        onStatusChange("Could not connect to server. Please refresh the page to try again.");
      }
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      debugLog(`Reconnected on attempt ${attemptNumber}`);
      onStatusChange("Reconnected to server. Click the microphone to start again.");
    });

    // Deepgram event listeners
    socketRef.current.on('deepgram_ready', (data) => {
      debugLog('Deepgram connection ready:', data);
      setDeepgramConnected(true);
      onStatusChange("Listening... Speak now");
    });

    socketRef.current.on('deepgram_stopped', (data) => {
      debugLog('Deepgram stopped:', data);
      setDeepgramConnected(false);
      
      if (recording) {
        stopRecording(true);
      }
      
      onStatusChange("Transcription stopped");
    });

    socketRef.current.on('deepgram_disconnected', (data) => {
      debugLog('Deepgram disconnected:', data);
      setDeepgramConnected(false);
      if (recording) {
        stopRecording(true);
        onStatusChange("Deepgram disconnected. Please try again.");
      }
    });

    socketRef.current.on('deepgram_error', (data) => {
      console.error('Deepgram error:', data);
      onStatusChange("Error with speech service: " + data.error);
    });

    socketRef.current.on('connection_lost', (data) => {
      console.error('Connection lost:', data);
      setDeepgramConnected(false);
      onStatusChange(data.message);
      
      if (recording) {
        stopRecording(true);
      }
    });

    socketRef.current.on('connection_error', (data) => {
      console.error('Connection error:', data);
      onStatusChange(data.message);
    });

    socketRef.current.on("transcription_update", (data) => {
      debugLog("Received transcription:", data.transcription);
      onTranscriptChange(data.transcription);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [onStatusChange, onTranscriptChange]);

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
          
          const arrayBuffer = await event.data.arrayBuffer();
          socket.emit("audio_stream", arrayBuffer);
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
    setRecording(true);
    onStatusChange("Initializing microphone...");
    
    try {
      microphoneRef.current = await getMicrophone();
      debugLog("Client: Waiting to open microphone");
      await openMicrophone(microphoneRef.current, socketRef.current);
      onStatusChange("Connecting to Deepgram...");
      
      // Only if socket is connected
      if (socketRef.current && socketRef.current.connected) {
        debugLog("Emitting toggle_transcription start event");
        socketRef.current.emit("toggle_transcription", { action: "start" });
      } else {
        throw new Error("Socket not connected, can't start transcription");
      }
    } catch (error) {
      setRecording(false);
      onStatusChange("Error starting recording: " + error.message);
    }
  };

  // Stop recording
  const stopRecording = (silent = false) => {
    if (recording) {
      debugLog("Stopping microphone");
      
      // First, signal the server to stop transcription
      if (!silent && socketRef.current && socketRef.current.connected) {
        debugLog("Sending stop signal to server");
        socketRef.current.emit("toggle_transcription", { action: "stop" });
      }
      
      // Set recording state to false immediately
      setRecording(false);
      
      // Stop the microphone
      if (microphoneRef.current) {
        try {
          microphoneRef.current.stop();
          document.body.classList.remove("recording");
        } catch (error) {
          console.error("Error stopping microphone:", error);
        }
      }
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
          disabled={!connected}
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
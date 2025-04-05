import React, { useState, useEffect } from 'react';
import './App.css';
import TranscriptionMic from './components/TranscriptionMic';

function App() {
  const [transcript, setTranscript] = useState('Realtime speech transcription API');
  const [status, setStatus] = useState('Click the microphone to start');
  
  return (
    <div className="App">
      <div className="container">
        <h1>Captions by Deepgram</h1>
        <TranscriptionMic 
          onStatusChange={setStatus}
          onTranscriptChange={setTranscript}
        />
        <div className="status-message">{status}</div>
        <div className="transcript-container">
          <div className="transcript">{transcript}</div>
        </div>
      </div>
    </div>
  );
}

export default App;

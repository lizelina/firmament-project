import React, { useState } from 'react';

const TestButton = () => {
  const [currentView, setCurrentView] = useState('list');
  
  const handleClick = () => {
    console.log("Button clicked, changing state from", currentView, "to 'new'");
    setCurrentView('new');
    setTimeout(() => {
      console.log("State after update:", currentView);
    }, 100);
  };
  
  return (
    <div style={{ padding: 20 }}>
      <h2>Test Button</h2>
      <p>Current view: {currentView}</p>
      <button onClick={handleClick}>
        Change View
      </button>
      
      {currentView === 'list' && <div>List View</div>}
      {currentView === 'new' && <div>New View</div>}
    </div>
  );
};

export default TestButton; 
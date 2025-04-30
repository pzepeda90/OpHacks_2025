import React from 'react';
import './BatchProgressBar.css';

const BatchProgressBar = ({ progress }) => {
  if (!progress || !progress.processing) return null;
  
  return (
    <div className="batch-progress-container">
      <div className="batch-progress-bar">
        <div 
          className="batch-progress-fill" 
          style={{ width: `${(progress.current / progress.total) * 100}%` }}
        ></div>
      </div>
      <p className="batch-progress-text">
        Analizando artículos: {progress.current} de {progress.total}
      </p>
    </div>
  );
};

export default BatchProgressBar; 
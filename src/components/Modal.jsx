// src/components/Modal.jsx

import React from 'react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, children, maxWidth, className = '' }) => {
  if (!isOpen) {
    return null;
  }

  // Funzione per non chiudere la modale se si clicca al suo interno
  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  const contentStyle = maxWidth ? { maxWidth } : undefined;

  return (
    <div className={`modal-overlay ${className}`.trim()} onClick={onClose}>
      <div className="modal-content" style={contentStyle} onClick={handleContentClick}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
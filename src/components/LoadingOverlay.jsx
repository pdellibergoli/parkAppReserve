import React from 'react';
import { useLoading } from '../context/LoadingContext';
import './LoadingOverlay.css';

const LoadingOverlay = () => {
  const { isLoading } = useLoading();

  if (!isLoading) {
    return null;
  }

  return (
    <div className="loading-overlay">
      <div className="spinner"></div>
    </div>
  );
};

export default LoadingOverlay;
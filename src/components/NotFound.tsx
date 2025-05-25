// src/components/NotFound.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * NotFound component displayed when a route is not found
 * This provides a user-friendly 404 page
 */
const NotFound: React.FC = () => {
  const navigate = useNavigate();

  // Navigate back to home page
  const goToHome = () => {
    navigate('/');
  };

  // Navigate back to previous page
  const goBack = () => {
    navigate(-1);
  };

  return (
    <div className="not-found-page">
      <div className="not-found-container">
        <h1 className="not-found-code">404</h1>
        <h2 className="not-found-title">Page Not Found</h2>
        <p className="not-found-message">
          We couldn't find the page you were looking for. 
          It might have been moved, deleted, or never existed.
        </p>
        
        <div className="not-found-actions">
          <button
            className="not-found-back-button"
            onClick={goBack}
          >
            Go Back
          </button>
          
          <button
            className="not-found-home-button"
            onClick={goToHome}
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

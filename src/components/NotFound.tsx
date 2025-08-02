// src/components/NotFound.tsx
import React from &apos;react&apos;;
import { useNavigate } from &apos;react-router-dom&apos;;

/**
 * NotFound component displayed when a route is not found
 * This provides a user-friendly 404 page
 */
const _NotFound: React.FC = () => {
  const navigate = useNavigate();

  // Navigate back to home page
  const goToHome = () => {
    navigate(&apos;/&apos;);
  };

  // Navigate back to previous page
  const goBack = () => {
    navigate(-1);
  };

  return (
    <div className=&quot;not-found-page&quot;>
      <div className=&quot;not-found-container&quot;>
        <h1 className=&quot;not-found-code&quot;>404</h1>
        <h2 className=&quot;not-found-title&quot;>Page Not Found</h2>
        <p className=&quot;not-found-message&quot;>
          We couldn&apos;t find the page you were looking for.
          It might have been moved, deleted, or never existed.
        </p>

        <div className=&quot;not-found-actions&quot;>
          <button
            className=&quot;not-found-back-button&quot;
            onClick={goBack}
          >
            Go Back
          </button>

          <button
            className=&quot;not-found-home-button&quot;
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

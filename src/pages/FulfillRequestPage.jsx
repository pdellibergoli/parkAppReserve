import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { callApi } from '../services/api';

const FulfillRequestPage = () => {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Elaborazione della tua richiesta...');
  const [error, setError] = useState('');

  useEffect(() => {
    const fulfillRequest = async () => {
      const requestId = searchParams.get('requestId');
      const donorUserId = searchParams.get('donorUserId');

      if (!requestId || !donorUserId) {
        setError('Link non valido o incompleto.');
        return;
      }

      try {
        const response = await callApi('fulfillParkingRequest', { requestId, donorUserId });
        setMessage(response.message);
      } catch (err) {
        setError(err.message);
      }
    };

    fulfillRequest();
  }, [searchParams]);

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Cessione Parcheggio</h2>
        {error && <p className="error-message">{error}</p>}
        {message && !error && <p className="success-message">{message}</p>}
        <p className="redirect-link" style={{ marginTop: '2rem' }}>
          <Link to="/">Torna alla Home</Link>
        </p>
      </div>
    </div>
  );
};

export default FulfillRequestPage;
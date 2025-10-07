import React, { useEffect, useState, useRef } from 'react'; // 1. Importa useRef
import { useSearchParams, Link } from 'react-router-dom';
import { callApi } from '../services/api';

const FulfillRequestPage = () => {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Elaborazione della tua richiesta...');
  const [error, setError] = useState('');

  // 2. Crea una "ref" per tenere traccia dell'esecuzione
  const hasFulfilled = useRef(false);

  useEffect(() => {
    // 3. Controlla se l'azione è già stata eseguita
    if (hasFulfilled.current) {
      return; // Se sì, non fare nulla
    }

    const fulfillRequest = async () => {
      // 4. Imposta il flag a true PRIMA di iniziare la chiamata API
      hasFulfilled.current = true;

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
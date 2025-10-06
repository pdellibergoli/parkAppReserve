import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { callApi } from '../services/api';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Verifica in corso...');
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      // Prende il token dall'URL (es. ?token=xxxxx)
      const token = searchParams.get('token');
      if (!token) {
        setError("Token di verifica non trovato nell'URL.");
        return;
      }

      try {
        const response = await callApi('verifyEmailToken', { token });
        setMessage(response.message);
      } catch (err) {
        setError(err.message || 'Si è verificato un errore durante la verifica.');
      }
    };

    verifyToken();
  }, [searchParams]); // L'effetto si attiva quando i parametri dell'URL sono disponibili

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Verifica Email</h2>
        {error && <p className="error-message">{error}</p>}
        {message && !error && <p className="success-message">{message}</p>}
        <p className="redirect-link" style={{ marginTop: '2rem' }}>
          <Link to="/login">Torna alla pagina di Login</Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
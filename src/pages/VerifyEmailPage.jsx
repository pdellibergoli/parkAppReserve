import React, { useEffect, useState, useRef } from 'react'; // 1. Importa useRef
import { useSearchParams, Link } from 'react-router-dom';
import { callApi } from '../services/api';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Verifica in corso...');
  const [error, setError] = useState('');

  // 2. Crea una "ref" per tenere traccia se la verifica è già stata tentata
  const hasVerified = useRef(false);

  useEffect(() => {
    // 3. Se abbiamo già eseguito la verifica, non fare nulla
    if (hasVerified.current) {
      return;
    }

    const verifyToken = async () => {
      // 4. Imposta il flag a true PRIMA di inviare la chiamata API
      hasVerified.current = true;

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
  }, [searchParams]);

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
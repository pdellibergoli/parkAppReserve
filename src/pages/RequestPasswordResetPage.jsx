import React, { useState } from 'react';
import { callApi } from '../services/api';
import { Link } from 'react-router-dom';

const RequestPasswordResetPage = () => {
  const [mail, setMail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await callApi('requestPasswordReset', { mail });
      setMessage(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Recupera Password</h2>
        <p>Inserisci la tua email per ricevere un link di recupero.</p>
        {!message ? (
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" value={mail} onChange={(e) => setMail(e.target.value)} required />
            </div>
            {error && <p className="error-message">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? <div className="spinner"></div> : 'Invia Link'}
            </button>
          </form>
        ) : (
          <p className="success-message">{message}</p>
        )}
        <p className="redirect-link">
          Tornare al <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
};
export default RequestPasswordResetPage;
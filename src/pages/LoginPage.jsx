import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { callApi } from '../services/api';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import logo from '../assets/logo.png'; // 1. IMPORTA IL LOGO

const LoginPage = () => {
  const [mail, setMail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [showResendLink, setShowResendLink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    // ... (logica handleSubmit invariata) ...
     if (e) e.preventDefault();
    setError('');
    setResendMessage('');
    setShowResendLink(false);
    setLoading(true);

    try {
      const loginResult = await login(mail, password);

      if (loginResult && loginResult.verificationNeeded) {
        setError(loginResult.message);
        setShowResendLink(true);
      } else if (!loginResult || !loginResult.id) {
        setError('Si è verificato un errore inaspettato durante il login.');
      }
    } catch (err) {
      setError(err.message || 'Credenziali non valide. Riprova.');
      setShowResendLink(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    // ... (logica handleResendEmail invariata) ...
    setLoading(true);
    setError('');
    setResendMessage('');
    try {
      const response = await callApi('resendVerificationEmail', { mail });
      setShowResendLink(false);
      setResendMessage(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">

        {/* --- 2. AGGIUNGI LOGO E TITOLO QUI --- */}
        <div className="auth-header">
          <img src={logo} alt="ParkApp Logo" className="auth-logo" />
        </div>
        {/* --- FINE AGGIUNTA --- */}

        <h2>Accedi</h2>
        <p>Prenota il tuo parcheggio aziendale.</p>
        <form onSubmit={handleSubmit}>
          {/* ... (resto del form invariato) ... */}
           <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              type="email" id="email" value={mail}
              onChange={(e) => { setMail(e.target.value); setShowResendLink(false); }}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          
          {error && <p className="error-message">{error}</p>}
          {resendMessage && <p className="success-message">{resendMessage}</p>}

          {showResendLink && (
            <div className="resend-container">
              <p>Non hai ricevuto l'email?</p>
              <button 
                type="button" 
                className="secondary-btn" 
                onClick={handleResendEmail}
                disabled={loading}
              >
                {loading ? 'Invio in corso...' : 'Invia di nuovo il link di verifica'}
              </button>
            </div>
          )}

          <button type="submit" disabled={loading} style={{marginTop: '1rem'}}>
            {loading ? <div className="spinner"></div> : 'Accedi'}
          </button>
        </form>
        <p className="redirect-link">
          Non hai un account? <Link to="/signup">Registrati</Link>
        </p>
        <p className="forgot-password-link">
          <Link to="/request-reset">Password dimenticata?</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
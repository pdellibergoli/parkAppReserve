import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { callApi } from '../services/api';
import { FaEye, FaEyeSlash } from 'react-icons/fa'; // <-- 1. Importa le icone

const LoginPage = () => {
  const [mail, setMail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [showResendLink, setShowResendLink] = useState(false);
  
  // --- 2. Aggiungi uno stato per la visibilità della password ---
  const [showPassword, setShowPassword] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    // ... la funzione handleSubmit rimane invariata ...
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
      } else if (loginResult && loginResult.id) {
        navigate('/');
      } else {
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
    // ... la funzione handleResendEmail rimane invariata ...
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
        <h2>Accedi</h2>
        <p>Prenota il tuo parcheggio aziendale.</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              type="email" id="email" value={mail}
              onChange={(e) => { setMail(e.target.value); setShowResendLink(false); }}
              required
            />
          </div>

          {/* --- 3. Modifica il gruppo della password --- */}
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'} // Cambia dinamicamente il tipo
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button" // Impedisce l'invio del form
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)} // Inverte lo stato di visibilità
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
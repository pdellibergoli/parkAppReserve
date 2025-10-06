import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { callApi } from '../services/api';
import { FaEye, FaEyeSlash } from 'react-icons/fa'; // 1. Importa le icone

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2. Aggiungi stati per la visibilità di entrambe le password
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      setError("Token di reset non trovato nell'URL.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await callApi('resetPassword', { token, newPassword: password });
      setMessage(response.message + " Verrai reindirizzato al login tra 3 secondi.");
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Imposta Nuova Password</h2>
        {!message ? (
          <form onSubmit={handleSubmit}>
            {/* 3. Modifica il gruppo della "Nuova Password" */}
            <div className="input-group">
              <label htmlFor="password">Nuova Password</label>
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

            {/* 4. Modifica il gruppo della "Conferma Nuova Password" */}
            <div className="input-group">
              <label htmlFor="confirmPassword">Conferma Nuova Password</label>
              <div className="password-input-wrapper">
                <input 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  id="confirmPassword" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required 
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            
            {error && <p className="error-message">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? <div className="spinner"></div> : 'Salva Password'}
            </button>
          </form>
        ) : (
          <p className="success-message">{message}</p>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
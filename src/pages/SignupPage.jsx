import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { Link } from 'react-router-dom';
import { FaRegEye, FaRegEyeSlash, FaRegCheckCircle, FaRegCircle } from 'react-icons/fa';
import { callApi } from '../services/api';
import './SignupPage.css';

const SignupPage = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mail, setMail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { signup } = useAuth();

  const performEmailCheck = useCallback(async (emailToCheck) => {
    const cleanMail = (emailToCheck || '').trim().toLowerCase();
    if (!cleanMail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanMail)) {
      setEmailError('');
      return;
    }
    setIsCheckingEmail(true);
    try {
      const res = await callApi('checkEmailExists', { mail: cleanMail });
      if (res?.exists) {
        setEmailError('Questa email risulta già registrata.');
      } else {
        setEmailError('');
      }
    } catch {
      // Ignora errori di rete temporanei
    } finally {
      setIsCheckingEmail(false);
    }
  }, []);

  useEffect(() => {
    const clean = mail.trim();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setEmailError('');
      return;
    }
    const timer = setTimeout(() => {
      performEmailCheck(clean);
    }, 400);
    return () => clearTimeout(timer);
  }, [mail, performEmailCheck]);

  // Logica di validazione real-time
  const checks = {
    length: password.length >= 6,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[=!@._*-]/.test(password),
    noForbidden: /^[A-Za-z0-9=!@._*-]*$/.test(password) && password.length > 0
  };

  const isPasswordValid = Object.values(checks).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (emailError) {
      setError(emailError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Le password non corrispondono.");
      return;
    }

    if (!isPasswordValid) {
      setError("La password non rispetta i requisiti di sicurezza.");
      return;
    }

    setLoading(true);
    try {
      await signup(firstName.trim(), lastName.trim(), mail.trim().toLowerCase(), password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Errore durante la registrazione. Riprova.');
      if (err.message && err.message.toLowerCase().includes('esiste già')) {
        setEmailError('Questa email risulta già registrata.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-form success-view">
          <FaRegCheckCircle size={64} color="#10b981" />
          <h2>Registrazione completata!</h2>
          <p>Ti abbiamo inviato un'email. Clicca sul link di conferma per attivare il tuo account prima di accedere.</p>
          <Link to="/login" className="btn-primary" style={{textDecoration: 'none', display: 'block', textAlign: 'center', marginTop: '1rem'}}>
            Vai al Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Crea un Account</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-row">
            <div className="input-group">
              <label>Nome</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Cognome</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="input-group">
            <label>Email</label>
            <input 
              type="email" 
              value={mail} 
              onChange={(e) => {
                setMail(e.target.value);
                if (emailError) setEmailError('');
              }} 
              onBlur={() => performEmailCheck(mail)}
              className={emailError ? 'input-error' : ''}
              required 
            />
            {isCheckingEmail && <span className="email-checking-hint">Verifica disponibilità email in corso...</span>}
            {emailError && (
              <div className="email-warning-box">
                <span className="email-warning-text">⚠️ {emailError}</span>
                <div className="email-warning-links">
                  <Link to="/login" className="email-warning-link">Accedi</Link>
                  <span className="email-warning-divider">•</span>
                  <Link to="/forgot-password" className="email-warning-link">Recupera Password</Link>
                </div>
              </div>
            )}
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="password-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="eye-btn">
                {showPassword ? <FaRegEyeSlash size={20} /> : <FaRegEye size={20} />}
              </button>
            </div>
          </div>

          {/* Box Requisiti Password */}
          <div className="password-checker">
            <div className={`check-item ${checks.length ? 'valid' : ''}`}>
              {checks.length ? <FaRegCheckCircle size={14} /> : <FaRegCircle size={14} />} 
              <span>Almeno 6 caratteri</span>
            </div>
            <div className={`check-item ${checks.hasLetter ? 'valid' : ''}`}>
              {checks.hasLetter ? <FaRegCheckCircle size={14} /> : <FaRegCircle size={14} />} 
              <span>Almeno una lettera</span>
            </div>
            <div className={`check-item ${checks.hasNumber ? 'valid' : ''}`}>
              {checks.hasNumber ? <FaRegCheckCircle size={14} /> : <FaRegCircle size={14} />} 
              <span>Almeno un numero</span>
            </div>
            <div className={`check-item ${checks.hasSpecial ? 'valid' : ''}`}>
              {checks.hasSpecial ? <FaRegCheckCircle size={14} /> : <FaRegCircle size={14} />} 
              <span>Simbolo speciale (=!@._*-)</span>
            </div>
            {!checks.noForbidden && password.length > 0 && (
              <p className="forbidden-warning">⚠ Caratteri non consentiti rilevati</p>
            )}
          </div>

          <div className="input-group">
            <label>Conferma Password</label>
            <div className="password-wrapper">
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="eye-btn">
                {showConfirmPassword ? <FaRegEyeSlash size={20} /> : <FaRegEye size={20} />}
              </button>
            </div>
          </div>

          {error && <div className="error-alert">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading || isCheckingEmail || Boolean(emailError) || !isPasswordValid}>
            {loading ? <span className="loader"></span> : 'Registrati'}
          </button>
        </form>
        
        <p className="auth-footer">
          Hai già un account? <Link to="/login">Accedi</Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
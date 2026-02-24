import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, Circle } from 'lucide-react';
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

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { signup } = useAuth();

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
      await signup(firstName, lastName, mail, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Errore durante la registrazione. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-form success-view">
          <CheckCircle2 size={64} color="#10b981" />
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
            <input type="email" value={mail} onChange={(e) => setMail(e.target.value)} required />
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
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Box Requisiti Password */}
          <div className="password-checker">
            <div className={`check-item ${checks.length ? 'valid' : ''}`}>
              {checks.length ? <CheckCircle2 size={14} /> : <Circle size={14} />} 
              <span>Almeno 6 caratteri</span>
            </div>
            <div className={`check-item ${checks.hasLetter ? 'valid' : ''}`}>
              {checks.hasLetter ? <CheckCircle2 size={14} /> : <Circle size={14} />} 
              <span>Almeno una lettera</span>
            </div>
            <div className={`check-item ${checks.hasNumber ? 'valid' : ''}`}>
              {checks.hasNumber ? <CheckCircle2 size={14} /> : <Circle size={14} />} 
              <span>Almeno un numero</span>
            </div>
            <div className={`check-item ${checks.hasSpecial ? 'valid' : ''}`}>
              {checks.hasSpecial ? <CheckCircle2 size={14} /> : <Circle size={14} />} 
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
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && <div className="error-alert">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading || !isPasswordValid}>
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
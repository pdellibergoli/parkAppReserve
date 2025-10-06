import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const SignupPage = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mail, setMail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false); // Nuovo stato per il successo

  const { signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(firstName, lastName, mail, password);
      setSuccess(true); // Imposta lo stato di successo
    } catch (err) {
      setError(err.message || 'Errore durante la registrazione. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Crea un Account</h2>
        
        {/* Mostra il messaggio di successo invece del form */}
        {success ? (
          <div className="success-container">
            <h3 style={{textAlign: 'center'}}>Registrazione completata!</h3>
            <p className="success-message" style={{textAlign: 'center'}}>
              Ti abbiamo inviato un'email. Clicca sul link di conferma per attivare il tuo account prima di poter accedere.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="firstName">Nome</label>
              <input type="text" id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
             <div className="input-group">
              <label htmlFor="lastName">Cognome</label>
              <input type="text" id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" value={mail} onChange={(e) => setMail(e.target.value)} required />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="error-message">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? <div className="spinner"></div> : 'Registrati'}
            </button>
          </form>
        )}
        
        <p className="redirect-link">
          Hai già un account? <Link to="/login">Accedi</Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
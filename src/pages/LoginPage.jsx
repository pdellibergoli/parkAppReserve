import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const LoginPage = () => {
  const [mail, setMail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // ⬅️ Stato di loading locale per lo spinner
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault(); 
    setError('');
    setLoading(true); // ⬅️ Iniziamo il loading locale e mostriamo lo spinner
    
    // Gestione della Promise di login (che ora ha un ritardo minimo)
    login(mail, password)
      .then(() => {
        // La navigazione avviene dopo che l'API call (con ritardo) è terminata
        navigate('/'); 
      })
      .catch((err) => {
        setError(err.message || 'Credenziali non valide. Riprova.');
      })
      .finally(() => {
        setLoading(false); // ⬅️ Terminiamo il loading locale
      });
  };

  // Se loading è true, mostra solo lo spinner centrato.
  if (loading) {
      return (
        <div className="auth-container">
          <div className="spinner"></div>
        </div>
      );
  }

  // Altrimenti, mostra il form di login.
  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Accedi</h2>
        <p>Prenota il tuo parcheggio aziendale.</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" disabled={loading}>
            Accedi
          </button>
        </form>
        <p className="redirect-link">
          Non hai un account? <Link to="/signup">Registrati</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
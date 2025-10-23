import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { callApi } from '../services/api';
import AvatarColorModal from '../components/AvatarColorModal';
import { getTextColor } from '../utils/colors';
import './ProfilePage.css';

// Componente AvatarDisplay (invariato)
const AvatarDisplay = ({ user }) => {
  const getInitials = () => {
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
    return user.firstName ? user.firstName[0] : 'U';
  };
  const backgroundColor = user.avatarColor || '#DE1F3C';
  const textColor = getTextColor(backgroundColor);
  return <div className="profile-avatar" style={{ backgroundColor: backgroundColor, color: textColor }}>{getInitials()}</div>;
};

const PRIMARY_COLOR_OPTIONS = [
  '#DE1F3C', // Rosso Default
  '#007bff', // Blu
  '#28a745', // Verde
  '#6f42c1', // Viola
  '#fd7e14', // Arancione
  '#20c997', // Ciano
];

const ProfilePage = () => {
  const { user, updateUserContext } = useAuth();
  const { theme, toggleTheme, primaryColor, setPrimaryColor } = useTheme();

  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName || '',
    mail: user.mail,
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // --- MODIFICA 1: Stati separati per messaggi/errori ---
  const [infoMessage, setInfoMessage] = useState('');
  const [infoError, setInfoError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  // --- Fine Modifica 1 ---

  const [loading, setLoading] = useState(false);
  const [isColorModalVisible, setIsColorModalVisible] = useState(false);

  const handleInfoChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Pulisci i messaggi quando l'utente modifica i dati
    setInfoMessage('');
    setInfoError('');
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    // Pulisci i messaggi quando l'utente modifica i dati
    setPasswordMessage('');
    setPasswordError('');
  };

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // --- MODIFICA 2: Pulisci tutti i messaggi prima dell'invio ---
    setInfoMessage('');
    setInfoError('');
    setPasswordMessage('');
    setPasswordError('');
    // --- Fine Modifica 2 ---

    const cleanId = user.id ? user.id.toString().trim() : null;
    if (!cleanId) {
      setInfoError("ID utente non valido."); // Imposta errore specifico
      setLoading(false);
      return;
    }

    try {
      const updatedUser = await callApi('updateUserProfile', {
        id: cleanId,
        ...formData,
      });
      updateUserContext(updatedUser);
      setInfoMessage('Informazioni personali aggiornate con successo!'); // Imposta messaggio specifico
    } catch (err) {
      setInfoError(err.message); // Imposta errore specifico
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
     // --- MODIFICA 3: Pulisci tutti i messaggi prima dell'invio ---
    setInfoMessage('');
    setInfoError('');
    setPasswordMessage('');
    setPasswordError('');
    // --- Fine Modifica 3 ---

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Le password non coincidono."); // Imposta errore specifico
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordError("La password deve essere di almeno 6 caratteri."); // Imposta errore specifico
      return;
    }
    setLoading(true);

    const cleanId = user.id ? user.id.toString().trim() : null;
    if (!cleanId) {
      setPasswordError("ID utente non valido."); // Imposta errore specifico
      setLoading(false);
      return;
    }

    try {
      await callApi('updateUserProfile', { id: cleanId, password: passwordData.newPassword });
      setPasswordMessage('Password modificata con successo!'); // Imposta messaggio specifico
      setPasswordData({ newPassword: '', confirmPassword: ''});
    } catch (err) {
      setPasswordError(err.message); // Imposta errore specifico
    } finally {
      setLoading(false);
    }
  };

  const handleColorSelected = async (newColor) => {
      setLoading(true);
      // Pulisci messaggi
      setInfoMessage('');
      setInfoError('');
      setPasswordMessage('');
      setPasswordError('');

      const cleanId = user.id ? user.id.toString().trim() : null;
      if (!cleanId) {
          setInfoError("ID utente non valido.");
          setLoading(false);
          return;
      }
      try {
          const updatedUser = await callApi('updateUserProfile', {
              id: cleanId,
              avatarColor: newColor
          });
          updateUserContext(updatedUser);
          setInfoMessage('Stile avatar aggiornato con successo!'); // Messaggio nella sezione info
      } catch (err) {
          setInfoError(err.message); // Errore nella sezione info
      } finally {
          setLoading(false);
      }
  };

  const handleThemeChange = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    toggleTheme(); // Aggiorna il contesto e localStorage

    // Salva nel backend (senza mostrare loading/messaggi invasivi)
    const cleanId = user.id ? user.id.toString().trim() : null;
    if (cleanId) {
        try {
            await callApi('updateUserProfile', { id: cleanId, preferredTheme: newTheme });
            // Potresti aggiungere un piccolo feedback non bloccante se vuoi
        } catch (err) {
            console.error("Errore salvataggio tema:", err);
            // Gestisci l'errore silenziosamente o con un toast
        }
    }
  };

  const handlePrimaryColorChange = async (newColor) => {
    setPrimaryColor(newColor); // Aggiorna contesto e localStorage

    // Salva nel backend
    const cleanId = user.id ? user.id.toString().trim() : null;
    if (cleanId) {
        try {
            await callApi('updateUserProfile', { id: cleanId, primaryColor: newColor });
        } catch (err) {
            console.error("Errore salvataggio colore primario:", err);
            // Potresti voler ripristinare il colore precedente in caso di errore
        }
    }
  };

  return (
    <div className="profile-container">
      <h1>Il mio profilo</h1>
      <div className="profile-card">
          <h2>Impostazioni Tema</h2>
          <div className="theme-toggle-container">
              <span>Tema Chiaro</span>
              <label className="switch">
                  <input
                      type="checkbox"
                      checked={theme === 'dark'}
                      onChange={handleThemeChange}
                  />
                  <span className="slider round"></span>
              </label>
              <span>Tema Scuro</span>
            </div>
            <div className="theme-toggle-container">
              <p>Colore Primario:</p>
              <div className="color-options-grid">
                  {PRIMARY_COLOR_OPTIONS.map(color => (
                      <button
                          key={color}
                          type="button"
                          className={`color-swatch ${primaryColor === color ? 'selected' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => handlePrimaryColorChange(color)}
                          title={`Imposta ${color} come primario`}
                      >
                          {primaryColor === color && '✓'}
                      </button>
                  ))}
              </div>
          </div>
      </div>

      {/* Card Informazioni e Avatar */}
      <div className="profile-card">
        <h2>Informazioni e Avatar</h2>

        {/* ... Sezione Avatar (invariata) ... */}
        <div className="avatar-info-group">
            <AvatarDisplay user={user} />
            <div className="info-group-details">
              <p>Personalizza l'aspetto del tuo avatar iniziale.</p>
              <button
                  type="button"
                  className="change-avatar-btn"
                  onClick={() => setIsColorModalVisible(true)}
                  disabled={loading}
              >
                  Cambia stile avatar
              </button>
            </div>
        </div>

        {/* Form Informazioni */}
        <form onSubmit={handleInfoSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">Nome</label>
              <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleInfoChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Cognome</label>
              <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleInfoChange} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="mail">Email</label>
            <input type="email" id="mail" name="mail" value={formData.mail} onChange={handleInfoChange} required />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? <div className="spinner-small"></div> : 'Salva Informazioni'}
          </button>
        </form>

        {/* --- MODIFICA 4: Sposta messaggi/errori qui --- */}
        {infoMessage && <p className="success-message" style={{marginTop: '1rem'}}>{infoMessage}</p>}
        {infoError && <p className="error-message" style={{marginTop: '1rem'}}>{infoError}</p>}
        {/* --- Fine Modifica 4 --- */}
      </div>

      {/* Card Modifica Password */}
      <div className="profile-card">
        <h2>Modifica Password</h2>
        <form onSubmit={handlePasswordSubmit}>
          <div className="form-group">
            <label htmlFor="newPassword">Nuova Password</label>
            <input type="password" id="newPassword" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Conferma Nuova Password</label>
            <input type="password" id="confirmPassword" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? <div className="spinner-small"></div> : 'Cambia Password'}
          </button>
        </form>

        {/* --- MODIFICA 5: Sposta messaggi/errori qui --- */}
        {passwordMessage && <p className="success-message" style={{marginTop: '1rem'}}>{passwordMessage}</p>}
        {passwordError && <p className="error-message" style={{marginTop: '1rem'}}>{passwordError}</p>}
        {/* --- Fine Modifica 5 --- */}
      </div>

      {/* MODIFICA 6: Rimuovi i messaggi/errori da qui */}
      {/* {message && <p className="success-message">{message}</p>} */}
      {/* {error && <p className="error-message">{error}</p>} */}
      {/* --- Fine Modifica 6 --- */}

      {/* Modale Colore Avatar (invariata) */}
      <AvatarColorModal
          isOpen={isColorModalVisible}
          onClose={() => setIsColorModalVisible(false)}
          currentColor={user.avatarColor || '#DE1F3C'}
          onColorSelected={handleColorSelected}
      />
    </div>
  );
};

export default ProfilePage;
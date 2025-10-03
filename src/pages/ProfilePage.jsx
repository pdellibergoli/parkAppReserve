// src/pages/ProfilePage.jsx

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../services/api';
import AvatarColorModal from '../components/AvatarColorModal'; // NUOVO COMPONENTE
import './ProfilePage.css';

/**
 * Determina il colore del testo (bianco o scuro) per un contrasto ottimale.
 * @param {string} hexColor - Codice colore HEX (#RRGGBB).
 * @returns {string} Il colore del testo da usare ('white' o '#213547').
 */
const getTextColor = (hexColor) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const cleanHex = hexColor.replace('#', '').replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);
    if (!result) return 'white'; 

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    const rs = r / 255;
    const gs = g / 255;
    const bs = b / 255;

    const luminance = 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    
    return luminance > 0.5 ? '#213547' : 'white'; 
};

// Componente per l'avatar dell'utente
const AvatarDisplay = ({ user }) => {
  const getInitials = () => {
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
    return user.firstName ? user.firstName[0] : 'U';
  };
  
  const backgroundColor = user.avatarColor || '#DE1F3C'; 
  const textColor = getTextColor(backgroundColor); // Applica la funzione di contrasto

  return <div className="profile-avatar" style={{ backgroundColor: backgroundColor, color: textColor }}>{getInitials()}</div>;
};


const ProfilePage = () => {
  const { user, updateUserContext } = useAuth();
  
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName || '',
    mail: user.mail,
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // STATO PER LA MODALE COLORE
  const [isColorModalVisible, setIsColorModalVisible] = useState(false); 

  const handleInfoChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const updatedUser = await callApi('updateUserProfile', { 
        id: user.id, 
        ...formData,
      }); 
      updateUserContext(updatedUser); 
      setMessage('Informazioni personali aggiornate con successo!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
        setError("Le password non coincidono.");
        return;
    }
    if (passwordData.newPassword.length < 6) {
        setError("La password deve essere di almeno 6 caratteri.");
        return;
    }
    setLoading(true);
    setMessage('');
    setError('');
    try {
        await callApi('updateUserProfile', { id: user.id, password: passwordData.newPassword });
        setMessage('Password modificata con successo!');
        setPasswordData({ newPassword: '', confirmPassword: ''}); // Pulisce i campi
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  // FUNZIONE PER CAMBIARE IL COLORE
  const handleColorSelected = async (newColor) => {
      setLoading(true);
      setMessage('');
      setError('');
      try {
          // Chiama l'API per aggiornare solo avatarColor
          const updatedUser = await callApi('updateUserProfile', { 
              id: user.id, 
              avatarColor: newColor 
          }); 
          // Aggiorna il contesto
          updateUserContext(updatedUser); 
          setMessage('Stile avatar aggiornato con successo!');
      } catch (err) {
          setError(err.message);
      } finally {
          setLoading(false);
      }
  };


  return (
    <div className="profile-container">
      <h1>Il mio profilo</h1>
      
      <div className="profile-card">
        <h2>Informazioni e Avatar</h2>
        
        <div className="avatar-info-group">
            <AvatarDisplay user={user} /> 
            
            <div className="info-group-details">
              <p>Personalizza l'aspetto del tuo avatar iniziale.</p>
              
              <button 
                  type="button" 
                  className="change-avatar-btn" 
                  onClick={() => setIsColorModalVisible(true)} // APRE LA MODALE
                  disabled={loading}
              >
                  Cambia stile avatar
              </button>
            </div>
        </div>

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
      </div>

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
      </div>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
      
      {/* MODALE PER IL CAMBIO COLORE AVATAR */}
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
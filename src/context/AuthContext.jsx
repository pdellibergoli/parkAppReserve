import React, { createContext, useState, useContext, useEffect } from 'react';
import { callApi } from '../services/api';

const AuthContext = createContext(null);

const SESSION_DURATION = 30 * 60 * 1000; 

export const AuthProvider = ({ children }) => {
  // ... il resto del file rimane invariato ...
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedSession = localStorage.getItem('parkingAppUser');
      if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        const now = new Date().getTime();

        if (now - sessionData.timestamp > SESSION_DURATION) {
          localStorage.removeItem('parkingAppUser');
          console.log("Sessione di test scaduta, utente disconnesso.");
        } else {
          setUser(sessionData.user);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (mail, password) => {
    const response = await callApi('login', { mail, password });

    // Se callApi restituisce direttamente l'oggetto utente (contiene .id)
    // oppure se restituisce l'involucro completo (contiene .data o .status === 'success')
    const userData = response?.id ? response : (response?.data || response);

    if (userData && userData.id) {
      setUser(userData);
      
      const sessionData = {
        user: userData,
        timestamp: new Date().getTime()
      };
      localStorage.setItem('parkingAppUser', JSON.stringify(sessionData));
      return userData;
    } else if (response && response.verificationNeeded) {
      return { verificationNeeded: true, message: response.message };
    } else {
      throw new Error(response?.message || 'Credenziali non valide.');
    }
  };
  
  const signup = async (firstName, lastName, mail, password) => {
    await callApi('signup', { firstName, lastName, mail, password });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('parkingAppUser');
  };
  
  const updateUserContext = (newUserData) => {
    const storedSession = localStorage.getItem('parkingAppUser');
    if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        
        const updatedUser = { ...sessionData.user, ...newUserData };
        const updatedSessionData = {
            ...sessionData,
            user: updatedUser
        };
        
        setUser(updatedUser);
        localStorage.setItem('parkingAppUser', JSON.stringify(updatedSessionData));
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    updateUserContext,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => {
  return useContext(AuthContext);
};
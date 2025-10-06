import React, { createContext, useState, useContext, useEffect } from 'react';
import { callApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('parkingAppUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (mail, password) => {
    const loggedInUser = await callApi('login', { mail, password });
    
    // Se il backend richiede la verifica, passiamo il messaggio
    if (loggedInUser && loggedInUser.verificationNeeded) {
        return loggedInUser;
    }
    
    // Altrimenti, login riuscito: impostiamo l'utente
    setUser(loggedInUser);
    localStorage.setItem('parkingAppUser', JSON.stringify(loggedInUser));
    return loggedInUser;
  };
  
  // --- MODIFICA CHIAVE QUI ---
  const signup = async (firstName, lastName, mail, password) => {
    // La registrazione ora chiama solo l'API. NON fa il login.
    await callApi('signup', { firstName, lastName, mail, password });
  };
  // --- FINE MODIFICA ---

  const logout = () => {
    setUser(null);
    localStorage.removeItem('parkingAppUser');
    window.location.href = '/login';
  };
  
  const updateUserContext = (newUserData) => {
    const updatedUser = { ...user, ...newUserData };
    setUser(updatedUser);
    localStorage.setItem('parkingAppUser', JSON.stringify(updatedUser));
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
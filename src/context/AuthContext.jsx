// src/context/AuthContext.jsx

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
    
    if (loggedInUser && loggedInUser.verificationNeeded) {
        return loggedInUser;
    }
    
    setUser(loggedInUser);
    localStorage.setItem('parkingAppUser', JSON.stringify(loggedInUser));
    return loggedInUser;
  };
  
  const signup = async (firstName, lastName, mail, password) => {
    await callApi('signup', { firstName, lastName, mail, password });
  };

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

  // --- MODIFICA CHIAVE QUI ---
  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    signup,
    logout, // <-- LA FUNZIONE MANCANTE È STATA AGGIUNTA QUI
    updateUserContext,
  };
  // --- FINE MODIFICA ---

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
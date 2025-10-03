// src/context/AuthContext.jsx

import React, { createContext, useState, useContext, useEffect } from 'react';
import { callApi } from '../services/api';

// 1. Creiamo il contesto
const AuthContext = createContext(null);

// 2. Creiamo il "Provider", il componente che fornirà i dati a tutta l'app
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Per sapere se stiamo ancora controllando il login iniziale

  // Controlla se l'utente è già loggato (es. da una sessione precedente)
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
    setLoading(true);
    try {
      const loggedInUser = await callApi('login', { mail, password });
      setUser(loggedInUser);
      localStorage.setItem('parkingAppUser', JSON.stringify(loggedInUser)); // Salviamo l'utente nel browser
      return loggedInUser;
    } catch (error) {
      // Se c'è un errore, lo rilanciamo per mostrarlo nel form di login
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  const signup = async (firstName, lastName, mail, password) => {
    setLoading(true);
    try {
      // 1. Chiamiamo lo script per registrare l'utente.
      const newUser = await callApi('signup', { firstName, lastName, mail, password });
      
      // 2. Usiamo i dati che lo script ci ha già restituito per effettuare l'accesso!
      // Non serve una seconda chiamata.
      setUser(newUser);
      localStorage.setItem('parkingAppUser', JSON.stringify(newUser));
      
      return newUser;
    } catch (error) {
      // Se c'è un errore qui, significa che la registrazione è fallita davvero.
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('parkingAppUser'); // Rimuoviamo l'utente dal browser
  };

  const updateUserContext = (newUserData) => {
    const updatedUser = { ...user, ...newUserData };
    setUser(updatedUser);
    localStorage.setItem('parkingAppUser', JSON.stringify(updatedUser));
  };

  // Questi sono i valori che il nostro contesto renderà disponibili
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
      {/* Non mostriamo nulla finché non abbiamo controllato se l'utente era già loggato */}
      {!loading && children}
    </AuthContext.Provider>
  );
};

// 3. Creiamo un "Hook" personalizzato per usare facilmente il contesto
export const useAuth = () => {
  return useContext(AuthContext);
};
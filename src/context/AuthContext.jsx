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

  // ... (tutte le altre funzioni come login, logout, ecc. rimangono invariate)
  const login = async (mail, password) => {
    const loggedInUser = await callApi('login', { mail, password });
    
    if (loggedInUser && loggedInUser.verificationNeeded) {
        return loggedInUser;
    }
    
    const sessionData = {
        user: loggedInUser,
        timestamp: new Date().getTime()
    };

    setUser(loggedInUser);
    localStorage.setItem('parkingAppUser', JSON.stringify(sessionData));
    return loggedInUser;
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
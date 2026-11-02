import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { callApi } from '../services/api';

const AuthContext = createContext(null);

const SESSION_DURATION = 30 * 60 * 1000; 

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeRegulation, setActiveRegulation] = useState(() => {
    try {
      const stored = localStorage.getItem('parkingAppActiveRegulation');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const refreshRegulation = useCallback(async () => {
    try {
      const reg = await callApi('getActiveRegulation');
      if (reg && reg.version) {
        setActiveRegulation(reg);
        localStorage.setItem('parkingAppActiveRegulation', JSON.stringify(reg));
        return reg;
      }
    } catch (e) {
      console.warn("Impossibile recuperare il regolamento:", e);
    }
    return null;
  }, []);

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
    refreshRegulation();
  }, [refreshRegulation]);

  const login = async (mail, password) => {
    const response = await callApi('login', { mail, password });

    const userData = response?.id ? response : (response?.data || response);

    if (userData && userData.id) {
      if (userData.activeRegulation) {
        setActiveRegulation(userData.activeRegulation);
        localStorage.setItem('parkingAppActiveRegulation', JSON.stringify(userData.activeRegulation));
      }
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
    } else if (user) {
        setUser(prev => ({ ...prev, ...newUserData }));
    }
  };

  // Un utente (nuovo o già registrato) ha accettato SOLO SE la versione registrata corrisponde a quella attiva sul DB
  const hasAcceptedRules = Boolean(
    user && 
    activeRegulation?.version && 
    user.acceptedRulesVersion && 
    String(user.acceptedRulesVersion) === String(activeRegulation.version)
  );

  const acceptRules = async () => {
    if (!user?.id) return;
    const targetVersion = String(activeRegulation?.version || '1.0');
    const response = await callApi('acceptRules', { userId: user.id, version: targetVersion });
    const updatedUser = response?.user || { 
      ...user, 
      hasAcceptedRules: true, 
      acceptedRulesVersion: targetVersion, 
      rulesAcceptedAt: new Date().toISOString() 
    };
    updateUserContext(updatedUser);
    sessionStorage.removeItem(`parkingAppRulesDismissed_${targetVersion}`);
    return updatedUser;
  };

  const updateCompanyRegulation = async ({ version, title, content, isActive }) => {
    if (!user?.id) throw new Error("Utente non autenticato.");
    const updated = await callApi('updateRegulation', {
      actorId: user.id,
      version,
      title,
      content,
      isActive
    });
    if (updated && updated.version) {
      setActiveRegulation(updated);
      localStorage.setItem('parkingAppActiveRegulation', JSON.stringify(updated));
    }
    return updated;
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    activeRegulation,
    refreshRegulation,
    updateCompanyRegulation,
    hasAcceptedRules,
    acceptRules,
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
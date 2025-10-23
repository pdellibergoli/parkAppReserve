import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext'; // Importa useAuth per accedere ai dati utente

const ThemeContext = createContext();

const DEFAULT_PRIMARY_COLOR = '#DE1F3C';

function darkenColor(hex, percent) {
  hex = hex.replace(/^\s*#|\s*$/g, '');
  if(hex.length == 3){
      hex = hex.replace(/(.)/g, '$1$1');
  }
  let r = parseInt(hex.substring(0, 2), 16),
      g = parseInt(hex.substring(2, 4), 16),
      b = parseInt(hex.substring(4, 6), 16);

  let factor = (100 - percent) / 100;

  r = Math.max(0, Math.min(255, Math.floor(r * factor)));
  g = Math.max(0, Math.min(255, Math.floor(g * factor)));
  b = Math.max(0, Math.min(255, Math.floor(b * factor)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth(); // Accedi ai dati utente

  // Stato per il tema light/dark
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  // Stato per il colore primario
  const [primaryColor, setPrimaryColorState] = useState(DEFAULT_PRIMARY_COLOR);

  // Effetto per caricare le preferenze iniziali dell'utente loggato
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const savedColor = localStorage.getItem('primaryColor');

    // Usa le preferenze dell'utente se disponibili, altrimenti quelle salvate o default
    const initialTheme = user?.preferredTheme || savedTheme || 'light';
    const initialColor = user?.primaryColor || savedColor || DEFAULT_PRIMARY_COLOR;
    
    setTheme(initialTheme);
    setPrimaryColorState(initialColor);

    // Salva nel localStorage se proveniente dall'utente e non già salvato
    if (user?.preferredTheme && user.preferredTheme !== savedTheme) {
        localStorage.setItem('theme', user.preferredTheme);
    }
    if (user?.primaryColor && user.primaryColor !== savedColor) {
        localStorage.setItem('primaryColor', user.primaryColor);
    }

  }, [user]); // Si attiva quando l'utente cambia (login/logout)


  // Effetto per applicare stili e salvare nel localStorage
  useEffect(() => {
    // Applica classe tema al body
    document.body.className = '';
    document.body.classList.add(`${theme}-theme`);
    localStorage.setItem('theme', theme);

    // Applica colore primario come variabile inline all'elemento <html>
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    // Calcola e imposta il colore hover (scurito del 15% in questo esempio)
    const hoverColor = darkenColor(primaryColor, 15); 
    document.documentElement.style.setProperty('--primary-color-hover', hoverColor);
    localStorage.setItem('primaryColor', primaryColor);

  }, [theme, primaryColor]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Funzione per impostare il colore primario
  const setPrimaryColor = (color) => {
    setPrimaryColorState(color);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, primaryColor, setPrimaryColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  return useContext(ThemeContext);
};
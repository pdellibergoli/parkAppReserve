import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaCalendarAlt, FaListUl, FaParking, FaChartBar, FaBars } from 'react-icons/fa';

import './MainLayout.css';

/**
 * Determina il colore del testo (bianco o scuro) per un contrasto ottimale.
 */
const getTextColor = (hexColor) => {
    // 1. Converte Hex in RGB (gestisce anche la forma abbreviata #RGB)
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

    // 2. Calcola la Luminanza (standard W3C)
    const luminance = 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    
    // 3. Soglia a 0.5: scuro per sfondi chiari, bianco per sfondi scuri
    return luminance > 0.5 ? '#213547' : 'white'; 
};

// Componente per l'avatar dell'utente
const UserAvatar = ({ user }) => {
  const getInitials = () => {
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
    return user.firstName ? user.firstName[0] : 'U';
  };
  
  const backgroundColor = user.avatarColor || '#DE1F3C'; 
  const textColor = getTextColor(backgroundColor); // Calcola il colore del testo

  return <div className="avatar" style={{ backgroundColor: backgroundColor, color: textColor }}>{getInitials()}</div>;
};

const MainLayout = () => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  return (
    <div className="main-layout">
      <header className="main-header">
        {/* Logo con immagine e testo */}
        <div className="logo">
          <img 
            src="https://download.logo.wine/logo/ALTEN/ALTEN-Logo.wine.png" 
            alt="Logo Alten" 
            className="logo-img"
          />
          <span>App Parcheggi</span>
        </div>
        
        {/* Contenitore per avatar e hamburger menu */}
        <div className="user-menu" ref={menuRef}>
          <UserAvatar user={user} />
          <button className="hamburger-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <FaBars />
          </button>

          {isMenuOpen && (
            <div className="dropdown">
              <div className="dropdown-item user-details">
                <p><strong>{user.firstName} {user.lastName}</strong></p>
                <p className="user-email">{user.mail}</p>
              </div>
              <hr />
              <Link to="/profile" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>Profilo</Link>
              <button onClick={logout} className="dropdown-item logout-btn">Logout</button>
            </div>
          )}
        </div>
      </header>
      
      <nav className="main-nav">
        <NavLink to="/" end><FaCalendarAlt /> <span>Calendario</span></NavLink>
        <NavLink to="/my-bookings"><FaListUl /><span>Le mie prenotazioni</span></NavLink>
        <NavLink to="/parking-spaces"><FaParking /><span>Parcheggi</span></NavLink>
        <NavLink to="/stats"><FaChartBar /><span>Statistiche</span></NavLink>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
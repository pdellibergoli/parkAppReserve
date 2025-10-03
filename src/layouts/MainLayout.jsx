// src/layouts/MainLayout.jsx

import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaCalendarAlt, FaListUl, FaParking, FaChartBar, FaBars } from 'react-icons/fa';

import './MainLayout.css';

// Componente per l'avatar dell'utente
const UserAvatar = ({ user }) => {
  const getInitials = () => {
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
    return user.firstName ? user.firstName[0] : 'U';
  };
  
  const color = user.avatarColor || '#DE1F3C'; 

  return <div className="avatar" style={{ backgroundColor: color }}>{getInitials()}</div>;
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
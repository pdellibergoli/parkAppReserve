// src/layouts/MainLayout.jsx

import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MainLayout.css';
// Importiamo le icone che ci servono
import { FaCalendarAlt, FaListUl, FaParking, FaChartBar } from 'react-icons/fa';

const UserAvatar = ({ user }) => {
  const getInitials = () => {
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
    return user.firstName ? user.firstName[0] : 'U';
  };
  return <div className="avatar">{getInitials()}</div>;
};

const MainLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="main-layout">
      <header className="main-header">
        <div className="logo">App Parcheggi</div>
        <div className="user-menu">
          <UserAvatar user={user} />
          <div className="dropdown">
            <p className="dropdown-item user-details">{user.firstName} {user.lastName}</p>
            <hr />
            <Link to="/profile" className="dropdown-item">Profilo</Link>
            <button onClick={logout} className="dropdown-item logout-btn">Logout</button>
          </div>
        </div>
      </header>
      
      <nav className="main-nav">
        <NavLink to="/" end>
          <FaCalendarAlt /> 
          <span>Calendario</span>
        </NavLink>
        <NavLink to="/my-bookings">
          <FaListUl />
          <span>Le mie prenotazioni</span>
        </NavLink>
        <NavLink to="/parking-spaces">
          <FaParking />
          <span>Parcheggi</span>
        </NavLink>
        <NavLink to="/stats">
          <FaChartBar />
          <span>Statistiche</span>
        </NavLink>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
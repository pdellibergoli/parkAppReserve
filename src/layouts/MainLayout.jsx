// src/layouts/MainLayout.jsx

import React, { useState } from 'react';
// --- MODIFICA 1: Importa useNavigate ---
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MainLayout.css';
import { FaCalendarAlt, FaListUl, FaParking, FaChartBar, FaBars, FaTimes } from 'react-icons/fa';
import logo from '../assets/logo.png';

const UserAvatar = ({ user }) => {
    const getInitials = () => {
        if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
        return user.firstName ? user.firstName[0] : 'U';
    };
    const avatarStyle = {
        backgroundColor: user.avatarColor || '#DE1F3C'
    };
    return <div className="avatar" style={avatarStyle}>{getInitials()}</div>;
};

const MainLayout = () => {
    const { user, logout } = useAuth();
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navigate = useNavigate(); // --- MODIFICA 2: Inizializza il navigatore ---

    // --- MODIFICA 3: Crea una funzione per gestire il logout ---
    const handleLogout = () => {
      logout(); // Pulisce i dati dell'utente
      navigate('/login'); // Naviga alla pagina di login
    };

    return (
        <div className="main-layout">
            <header className="main-header">
                <Link to="/" className="logo">
                    <img src={logo} alt="Alten Logo" className="logo-img" />
                    <span>ParkApp</span>
                </Link>
                <div className="header-right">
                    <div className="user-menu">
                        <UserAvatar user={user} />
                        <div className="dropdown">
                            <div className="user-details">
                                <p>{user.firstName} {user.lastName}</p>
                                <p className="user-email">{user.mail}</p>
                            </div>
                            <hr />
                            <Link to="/profile" className="dropdown-item">Profilo</Link>
                            {/* --- MODIFICA 4: Chiama la nuova funzione --- */}
                            <button onClick={handleLogout} className="dropdown-item logout-btn">Logout</button>
                        </div>
                    </div>
                    <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}>
                        {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
                    </button>
                </div>
            </header>
            
            {/* Il resto del file rimane invariato */}
            <nav className={`main-nav ${isMobileMenuOpen ? 'mobile-active' : ''}`}>
                <NavLink to="/" end onClick={() => setMobileMenuOpen(false)}><FaCalendarAlt /> <span>Calendario</span></NavLink>
                <NavLink to="/my-bookings" onClick={() => setMobileMenuOpen(false)}><FaListUl /><span>Le mie prenotazioni</span></NavLink>
                <NavLink to="/parking-spaces" onClick={() => setMobileMenuOpen(false)}><FaParking /><span>Parcheggi</span></NavLink>
                <NavLink to="/stats" onClick={() => setMobileMenuOpen(false)}><FaChartBar /><span>Statistiche</span></NavLink>
            </nav>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
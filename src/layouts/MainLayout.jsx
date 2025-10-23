import React, { useState, useRef, useCallback } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AddRequestModal from '../components/AddRequestModal';
import EditRequestModal from '../components/EditRequestModal'; // 1. IMPORTA LA NUOVA MODALE
import { getTextColor } from '../utils/colors';
import './MainLayout.css';
import { FaCalendarAlt, FaListUl, FaParking, FaChartBar, FaBars, FaTimes } from 'react-icons/fa';
import logo from '../assets/logo.png';

const UserAvatar = ({ user }) => {
    const getInitials = () => {
        if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
        return user.firstName ? user.firstName[0] : 'U';
    };
    const backgroundColor = user.avatarColor || '#DE1F3C';
    const textColor = getTextColor(backgroundColor);
    
    const avatarStyle = { backgroundColor, color: textColor };
    return <div className="avatar" style={avatarStyle}>{getInitials()}</div>;
};

const MainLayout = () => {
    const { user, logout } = useAuth();
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navigate = useNavigate();
    
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); // 2. STATO PER LA MODALE DI MODIFICA
    const [requestToEdit, setRequestToEdit] = useState(null);    // 3. STATO PER MEMORIZZARE LA RICHIESTA DA MODIFICARE
    const [refreshKey, setRefreshKey] = useState(0);

    const forceDataRefresh = useCallback(() => {
        setRefreshKey(prevKey => prevKey + 1);
    }, []);

    const handleSuccess = () => {
        forceDataRefresh();
        setIsAddModalOpen(false);
        setIsEditModalOpen(false); // Assicurati di chiudere anche la modale di modifica
        setRequestToEdit(null);
    };

    // 4. FUNZIONI PER GESTIRE LA MODALE DI MODIFICA
    const handleOpenEditModal = (request) => {
        setRequestToEdit(request);
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setRequestToEdit(null);
    };

    const handleOpenAddModal = () => setIsAddModalOpen(true);
    
    // Logica menu utente (invariata)
    const [isUserMenuOpen, setUserMenuOpen] = useState(false);
    const menuTimerRef = useRef(null);
    const handleMenuEnter = () => { clearTimeout(menuTimerRef.current); setUserMenuOpen(true); };
    const handleMenuLeave = () => { menuTimerRef.current = setTimeout(() => { setUserMenuOpen(false); }, 300); };
    const handleLogout = () => { logout(); navigate('/login'); };
    
    return (
        <div className="main-layout">
            <header className="main-header">
                {/* ... header invariato ... */}
                 <Link to="/" className="logo">
                    <img src={logo} alt="Park App Reserve" className="logo-img" />
                    <span>Park App Reserve</span>
                </Link>
                <div className="header-right">
                    <div className="user-menu" onMouseEnter={handleMenuEnter} onMouseLeave={handleMenuLeave}>
                        <span className="user-display-name">{user.firstName} {user.lastName}</span>
                        <UserAvatar user={user} />
                        <div className={`dropdown ${isUserMenuOpen ? 'show' : ''}`}>
                            <div className="user-details">
                                <p>{user.firstName} {user.lastName}</p>
                                <p className="user-email">{user.mail}</p>
                            </div>
                            <hr />
                            <Link to="/profile" className="dropdown-item">Profilo</Link>
                            <button onClick={handleLogout} className="dropdown-item logout-btn">Logout</button>
                        </div>
                    </div>
                    <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}>
                        {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
                    </button>
                </div>
            </header>
            
            <nav className={`main-nav ${isMobileMenuOpen ? 'mobile-active' : ''}`}>
                 <NavLink to="/" end onClick={() => setMobileMenuOpen(false)}><FaCalendarAlt /> <span>Calendario</span></NavLink>
                <NavLink to="/my-requests" onClick={() => setMobileMenuOpen(false)}><FaListUl /><span>Le mie richieste</span></NavLink>
                {user && user.isAdmin === true && (
                    <NavLink to="/parking-spaces" onClick={() => setMobileMenuOpen(false)}><FaParking /><span>Parcheggi</span></NavLink>
                )}
                <NavLink to="/stats" onClick={() => setMobileMenuOpen(false)}><FaChartBar /><span>Statistiche</span></NavLink>
            </nav>

            <main className="main-content">
                {/* 5. PASSA LE NUOVE FUNZIONI AL CONTESTO */}
                <Outlet context={{ handleOpenAddModal, handleOpenEditModal, forceDataRefresh, refreshKey }} />
            </main>

            <AddRequestModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onRquestCreated={handleSuccess}
            />

            {/* 6. AGGIUNGI LA NUOVA MODALE AL LAYOUT */}
            <EditRequestModal
                isOpen={isEditModalOpen}
                onClose={handleCloseEditModal}
                onRequestUpdated={handleSuccess}
                requestData={requestToEdit}
            />
        </div>
    );
};

export default MainLayout;
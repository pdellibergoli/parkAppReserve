import React, { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getTextColor } from '../utils/colors';
import { preloadAppPages } from '../utils/preload';
import { useQuery } from '../hooks/useQuery';
import { applyRequestUpdate, cachedMonthRequests, monthQuery, prefetch, referenceQuery } from '../services/queries';
import './MainLayout.css';
import { FaCalendarAlt, FaListUl, FaParking, FaChartBar, FaBars, FaTimes } from 'react-icons/fa';
import logo from '../assets/logo.png';

// Caricate solo quando servono: contengono react-day-picker, che altrimenti
// finirebbe nel bundle iniziale
const AddRequestModal = lazy(() => import('../components/AddRequestModal'));
const EditRequestModal = lazy(() => import('../components/EditRequestModal'));

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
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [requestToEdit, setRequestToEdit] = useState(null);

    const { data: reference } = useQuery(referenceQuery());

    // I dati partono insieme al codice delle pagine, senza aspettarlo
    const isAdmin = user?.isAdmin === true;
    useEffect(() => {
        prefetch(monthQuery(new Date()));
        preloadAppPages(isAdmin);
    }, [isAdmin]);

    // Oggetto stabile: le pagine non si ri-renderizzano quando cambia solo lo stato del layout
    const outletContext = useMemo(() => ({
        handleOpenAddModal: () => setIsAddModalOpen(true),
        handleOpenEditModal: (request, actorId = null) => {
            setRequestToEdit({ ...request, actorId });
            setIsEditModalOpen(true);
        },
    }), []);

    const handleCloseModals = () => {
        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
        setRequestToEdit(null);
    };
    
    const [isUserMenuOpen, setUserMenuOpen] = useState(false);
    const menuTimerRef = useRef(null);
    const handleMenuEnter = () => { clearTimeout(menuTimerRef.current); setUserMenuOpen(true); };
    const handleMenuLeave = () => { menuTimerRef.current = setTimeout(() => { setUserMenuOpen(false); }, 300); };
    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <div className="main-layout">
            <header className="main-header">
                 <Link to="/" className="logo">
                    <img src={logo} alt="Park App Reserve" className="logo-img" />
                    <span>Park App Reserve</span>
                </Link>
                <div className="header-right">
                    <a 
                        href="https://www.paypal.com/donate/?hosted_button_id=ZYAR6VYBQC3UL" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="navbar-paypal"
                    >
                        Buy me a coffee! ☕
                    </a>
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
                {/* Confine proprio: mentre si scarica una pagina il layout resta visibile e i dati partono */}
                <Suspense fallback={<div className="loading-container"><div className="spinner"></div></div>}>
                    <Outlet context={outletContext} />
                </Suspense>
            </main>

            {/* Montate solo quando aperte: ne ritardano il caricamento */}
            {isAddModalOpen && (
                <Suspense fallback={null}>
                    <AddRequestModal
                        isOpen={isAddModalOpen}
                        onClose={handleCloseModals}
                        onOptimisticUpdate={applyRequestUpdate}
                        usersList={reference?.users}
                        allRequests={cachedMonthRequests()}
                    />
                </Suspense>
            )}

            {isEditModalOpen && (
                <Suspense fallback={null}>
                    <EditRequestModal
                        isOpen={isEditModalOpen}
                        onClose={handleCloseModals}
                        onRequestUpdated={handleCloseModals}
                        requestData={requestToEdit}
                        onOptimisticUpdate={applyRequestUpdate}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default MainLayout;
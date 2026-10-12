import React, { useState, useRef, useCallback, lazy, Suspense } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTextColor } from '../utils/colors';
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
    const [refreshKey, setRefreshKey] = useState(0);

    // CACHE GLOBALE DEI MESI (In memoria tra i cambi di pagina)
    const globalMonthCacheRef = useRef({});
    const globalStatsCacheRef = useRef(null);

    // Dati condivisi fra layout, pagine e modali.
    // REF e non state: aggiornarli non deve far ri-renderizzare il layout (e con
    // l'Outlet tutte le pagine) ogni volta che i dati cambiano. Le modali li
    // leggono all'apertura, quando il layout re-renderizza comunque.
    const sharedDataRef = useRef({
        onUpdate: null,
        onDelete: null,
        usersList: [],
        allRequests: []
    });

    const registerOptimisticHandlers = useCallback((data) => {
        Object.assign(sharedDataRef.current, data);
    }, []);

    const forceDataRefresh = useCallback(() => {
        globalMonthCacheRef.current = {};
        globalStatsCacheRef.current = null;
        setRefreshKey(prevKey => prevKey + 1);
    }, []);

    const handleCloseModals = () => {
        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
        setRequestToEdit(null);
    };

    const handleOpenEditModal = (request, actorId = null) => {
        setRequestToEdit({ ...request, actorId: actorId });
        setIsEditModalOpen(true);
    };

    const handleOpenAddModal = () => setIsAddModalOpen(true);
    
    const [isUserMenuOpen, setUserMenuOpen] = useState(false);
    const menuTimerRef = useRef(null);
    const handleMenuEnter = () => { clearTimeout(menuTimerRef.current); setUserMenuOpen(true); };
    const handleMenuLeave = () => { menuTimerRef.current = setTimeout(() => { setUserMenuOpen(false); }, 300); };
    const handleLogout = () => { logout(); navigate('/login'); };

    const sharedData = sharedDataRef.current;
    
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
                <Outlet context={{ 
                    globalMonthCacheRef,
                    globalStatsCacheRef,
                    handleOpenAddModal, 
                    handleOpenEditModal, 
                    forceDataRefresh, 
                    refreshKey,
                    handleCloseModals,
                    registerOptimisticHandlers,
                    sharedUsers: sharedData.usersList,
                    sharedSpaces: sharedData.parkingSpaces,
                    sharedRequests: sharedData.allRequests
                }} />
            </main>

            {/* Montate solo quando aperte: ne ritardano il caricamento */}
            {isAddModalOpen && (
                <Suspense fallback={null}>
                    <AddRequestModal
                        isOpen={isAddModalOpen}
                        onClose={handleCloseModals}
                        onRquestCreated={handleCloseModals}
                        onOptimisticUpdate={sharedData.onUpdate}
                        usersList={sharedData.usersList}
                        allRequests={sharedData.allRequests}
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
                        onOptimisticUpdate={sharedData.onUpdate}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default MainLayout;
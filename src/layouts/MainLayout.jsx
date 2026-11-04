import React, { useState, useRef, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
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
const RulesModal = lazy(() => import('../components/RulesModal'));

const UserAvatar = ({ user }) => {
    const getInitials = () => {
        if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
        return user.firstName ? user.firstName[0] : 'U';
    };
    const backgroundColor = user.avatarColor || '#DE1F3C';
    const textColor = getTextColor(backgroundColor);
    
    const avatarStyle = { backgroundColor, color: textColor };
    return <span className="avatar" style={avatarStyle}>{getInitials()}</span>;
};

const MainLayout = () => {
    const { user, logout, hasAcceptedRules, activeRegulation } = useAuth();
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navigate = useNavigate();
    
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
    const [rulesReadOnly, setRulesReadOnly] = useState(false);
    const [requestToEdit, setRequestToEdit] = useState(null);

    const { data: reference } = useQuery(referenceQuery());

    // I dati partono insieme al codice delle pagine, senza aspettarlo
    const isAdmin = user?.isAdmin === true;
    useEffect(() => {
        prefetch(monthQuery(new Date()));
        preloadAppPages(isAdmin);
    }, [isAdmin]);

    const activeVersion = activeRegulation?.version || '1.0';

    // Al login mostra automaticamente il regolamento se l'utente non ha ancora accettato l'ultima versione attiva
    useEffect(() => {
        if (user && !hasAcceptedRules) {
            const dismissed = sessionStorage.getItem(`parkingAppRulesDismissed_${activeVersion}`);
            if (!dismissed) {
                setRulesReadOnly(false);
                setIsRulesModalOpen(true);
            }
        }
    }, [user, hasAcceptedRules, activeVersion]);

    const handleOpenRulesModal = useCallback((readOnly = false) => {
        setRulesReadOnly(readOnly);
        setIsRulesModalOpen(true);
    }, []);

    const handleCloseRulesModal = useCallback(() => {
        sessionStorage.setItem(`parkingAppRulesDismissed_${activeVersion}`, 'true');
        setIsRulesModalOpen(false);
    }, [activeVersion]);

    const handleOpenAddModal = useCallback(() => {
        if (!hasAcceptedRules) {
            setRulesReadOnly(false);
            setIsRulesModalOpen(true);
            return;
        }
        setIsAddModalOpen(true);
    }, [hasAcceptedRules]);

    // Oggetto stabile: le pagine non si ri-renderizzano quando cambia solo lo stato del layout
    const outletContext = useMemo(() => ({
        handleOpenAddModal,
        handleOpenEditModal: (request, actorId = null) => {
            setRequestToEdit({ ...request, actorId });
            setIsEditModalOpen(true);
        },
        handleOpenRulesModal,
        hasAcceptedRules,
    }), [handleOpenAddModal, handleOpenRulesModal, hasAcceptedRules]);

    const handleCloseModals = () => {
        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
        setRequestToEdit(null);
    };
    
    const location = useLocation();
    const [isUserMenuOpen, setUserMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const menuTimerRef = useRef(null);

    // Chiude automaticamente i menu al cambio pagina
    useEffect(() => {
        setUserMenuOpen(false);
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Chiusura al tocco/click all'esterno o premendo Escape
    useEffect(() => {
        if (!isUserMenuOpen) return;

        const handleOutsideClick = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setUserMenuOpen(false);
            }
        };

        document.addEventListener('pointerdown', handleOutsideClick);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handleOutsideClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isUserMenuOpen]);

    const lastEnterTimeRef = useRef(0);

    const handleMenuEnter = (e) => {
        // Solo per dispositivi con reale supporto hover (desktop con mouse/trackpad)
        if (typeof window !== 'undefined' && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            return;
        }
        const pointerType = e?.pointerType || e?.nativeEvent?.pointerType;
        if (pointerType === 'touch' || pointerType === 'pen') return;

        lastEnterTimeRef.current = Date.now();
        clearTimeout(menuTimerRef.current);
        setUserMenuOpen(true);
    };

    const handleMenuLeave = (e) => {
        if (typeof window !== 'undefined' && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            return;
        }
        const pointerType = e?.pointerType || e?.nativeEvent?.pointerType;
        if (pointerType === 'touch' || pointerType === 'pen') return;

        clearTimeout(menuTimerRef.current);
        menuTimerRef.current = setTimeout(() => {
            setUserMenuOpen(false);
        }, 200);
    };

    const handleToggleMenu = (e) => {
        e.stopPropagation();
        clearTimeout(menuTimerRef.current);

        // Se è appena entrato con il mouse (hover desktop che ha già aperto il menu),
        // il click non deve richiuderlo immediatamente
        const justEntered = Date.now() - lastEnterTimeRef.current < 350;
        if (justEntered && isUserMenuOpen) {
            return;
        }

        setUserMenuOpen((prev) => !prev);
        setMobileMenuOpen(false);
    };

    const handleLogout = () => {
        setUserMenuOpen(false);
        logout();
        navigate('/login');
    };

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
                    <div 
                        className="user-menu" 
                        ref={menuRef}
                        onPointerEnter={handleMenuEnter}
                        onPointerLeave={handleMenuLeave}
                        onMouseEnter={handleMenuEnter}
                        onMouseLeave={handleMenuLeave}
                    >
                        <button
                            type="button"
                            className="user-menu-trigger"
                            onClick={handleToggleMenu}
                            aria-expanded={isUserMenuOpen}
                            aria-haspopup="true"
                            aria-label="Menu profilo utente"
                        >
                            <span className="user-display-name">{user.firstName} {user.lastName}</span>
                            <UserAvatar user={user} />
                        </button>
                        <div 
                            className={`dropdown ${isUserMenuOpen ? 'show' : ''}`}
                            role="menu"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="user-details">
                                <p>{user.firstName} {user.lastName}</p>
                                <p className="user-email">{user.mail}</p>
                            </div>
                            <hr />
                            <button 
                                type="button"
                                onClick={() => {
                                    setUserMenuOpen(false);
                                    handleOpenRulesModal(hasAcceptedRules);
                                }} 
                                className="dropdown-item"
                            >
                                Regolamento
                            </button>
                            <Link 
                                to="/profile" 
                                className="dropdown-item"
                                onClick={() => setUserMenuOpen(false)}
                            >
                                Profilo
                            </Link>
                            <button onClick={handleLogout} className="dropdown-item logout-btn">Logout</button>
                        </div>
                    </div>
                    <button 
                        className="mobile-menu-toggle" 
                        onClick={() => {
                            setMobileMenuOpen(!isMobileMenuOpen);
                            setUserMenuOpen(false);
                        }}
                        aria-label="Menu navigazione"
                    >
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
            {isRulesModalOpen && (
                <Suspense fallback={null}>
                    <RulesModal
                        isOpen={isRulesModalOpen}
                        onClose={handleCloseRulesModal}
                        onAcceptSuccess={() => {
                            sessionStorage.removeItem('parkingAppRulesDismissed');
                        }}
                        isReadOnly={rulesReadOnly}
                    />
                </Suspense>
            )}

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
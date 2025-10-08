import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../services/api';
import AddBookingModal from '../components/AddBookingModal';
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
    
    // --- Stati per dati e modali ---
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [allBookings, setAllBookings] = useState([]); 
    const [users, setUsers] = useState([]);
    const [parkingSpaces, setParkingSpaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [bookingToEdit, setBookingToEdit] = useState(null);

    // --- Funzioni di caricamento dati ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
          const [bookingsData, usersData, spacesData] = await Promise.all([
            callApi('getBookings'),
            callApi('getUsers'),
            callApi('getParkingSpaces'),
          ]);
    
          setUsers(usersData);
          setParkingSpaces(spacesData);
          setAllBookings(bookingsData);
        } catch (err) {
          setError('Impossibile caricare i dati. Riprova più tardi.');
        } finally {
          setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    
    // 1. Funzione generica per il successo (sia aggiunta che modifica)
    const handleBookingSuccess = () => {
        fetchData(); // Ricarica i dati
        handleCloseModal(); // Chiude la modale
    };
    
    // 2. Funzione per aprire la modale in modalità modifica (da passare ai figli)
    const handleOpenEditModal = (booking) => {
        const bookingDate = new Date(booking.date);
        const today = new Date();
        if (bookingDate.setHours(0,0,0,0) < today.setHours(0,0,0,0)) {
            alert("Non è possibile modificare una prenotazione passata.");
            return;
        }
        setBookingToEdit(booking);
    };

    // 3. Funzione generica per chiudere la modale
    const handleCloseModal = () => {
        setIsAddModalOpen(false);
        setBookingToEdit(null);
    };

    // --- Logica per il menu utente ---
    const [isUserMenuOpen, setUserMenuOpen] = useState(false);
    const menuTimerRef = useRef(null);

    const handleMenuEnter = () => {
        clearTimeout(menuTimerRef.current);
        setUserMenuOpen(true);
    };

    const handleMenuLeave = () => {
        menuTimerRef.current = setTimeout(() => {
            setUserMenuOpen(false);
        }, 300);
    };

    const handleLogout = () => {
      logout();
      navigate('/login');
    };

    return (
        <div className="main-layout">
            <header className="main-header">
                <Link to="/" className="logo">
                    <img src={logo} alt="ParkApp" className="logo-img" />
                    <span>ParkApp</span>
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
                <NavLink to="/my-bookings" onClick={() => setMobileMenuOpen(false)}><FaListUl /><span>Le mie prenotazioni</span></NavLink>
                {user && user.isAdmin === true && (
                    <NavLink to="/parking-spaces" onClick={() => setMobileMenuOpen(false)}><FaParking /><span>Parcheggi</span></NavLink>
                )}
                <NavLink to="/stats" onClick={() => setMobileMenuOpen(false)}><FaChartBar /><span>Statistiche</span></NavLink>
            </nav>

            <main className="main-content">
                {/* 4. Passa la nuova funzione 'handleOpenEditModal' alle pagine figlie */}
                <Outlet context={{ allBookings, users, parkingSpaces, loading, error, fetchData, handleOpenEditModal }} />
            </main>

            <button className="add-booking-btn" onClick={() => setIsAddModalOpen(true)}>+</button>

            {/* 5. Aggiorna le props della modale per gestire sia l'aggiunta che la modifica */}
            <AddBookingModal
                isOpen={isAddModalOpen || !!bookingToEdit}
                onClose={handleCloseModal}
                onBookingAdded={handleBookingSuccess}
                initialBookingData={bookingToEdit}
                parkingSpaces={parkingSpaces}
                allBookings={allBookings}
            />
        </div>
    );
};

export default MainLayout;
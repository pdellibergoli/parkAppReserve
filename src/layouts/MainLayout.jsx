import React, { useState, useRef, useEffect, useCallback } from 'react'; // Aggiungi useEffect e useCallback
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../services/api'; // Importa callApi
import AddBookingModal from '../components/AddBookingModal'; // Importa la modale
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
    const navigate = useNavigate();
    
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    // Stati per i dati globali dell'applicazione
    const [allBookings, setAllBookings] = useState([]); 
    const [users, setUsers] = useState([]);
    const [parkingSpaces, setParkingSpaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Funzione per caricare tutti i dati
    const fetchData = useCallback(async () => {
        try {
          setLoading(true);
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

    // Carica i dati al primo rendering del layout
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Funzione da passare alla modale per ricaricare i dati dopo l'aggiunta
    const handleBookingAdded = () => {
        fetchData();
    };

    // --- NUOVA LOGICA PER IL MENU DROPDOWN ---
    const [isUserMenuOpen, setUserMenuOpen] = useState(false);
    const menuTimerRef = useRef(null); // 2. Per memorizzare il nostro timer

    // 3. Funzione per quando il mouse entra nell'area del menu
    const handleMenuEnter = () => {
        clearTimeout(menuTimerRef.current); // Annulla qualsiasi timer di chiusura
        setUserMenuOpen(true); // Apri il menu
    };

    // 4. Funzione per quando il mouse esce dall'area del menu
    const handleMenuLeave = () => {
        // Avvia un timer per chiudere il menu dopo 300ms
        menuTimerRef.current = setTimeout(() => {
            setUserMenuOpen(false);
        }, 300);
    };
    // --- FINE NUOVA LOGICA ---

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
                    {/* 5. Applica i gestori di eventi al contenitore del menu */}
                    <div 
                        className="user-menu" 
                        onMouseEnter={handleMenuEnter} 
                        onMouseLeave={handleMenuLeave}
                    >
                        <UserAvatar user={user} />
                        {/* 6. Usa lo stato per mostrare/nascondere il menu */}
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
                <NavLink to="/parking-spaces" onClick={() => setMobileMenuOpen(false)}><FaParking /><span>Parcheggi</span></NavLink>
                <NavLink to="/stats" onClick={() => setMobileMenuOpen(false)}><FaChartBar /><span>Statistiche</span></NavLink>
            </nav>

            <main className="main-content">
                <Outlet context={{ allBookings, users, parkingSpaces, loading, error, fetchData }} />
            </main>

            <button className="add-booking-btn" onClick={() => setIsAddModalOpen(true)}>+</button>

            {/* Anche la modale ora vive qui */}
            <AddBookingModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onBookingAdded={handleBookingAdded} 
                parkingSpaces={parkingSpaces}
                allBookings={allBookings}
            />
        </div>
    );
};

export default MainLayout;
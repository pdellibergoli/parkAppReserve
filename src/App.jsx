import React, { useState, useEffect, useRef } from 'react';

// --- L'URL VIENE ORA LETTO DALLE VARIABILI D'AMBIENTE ---
const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;

// --- ICONE SVG (invariate) ---
const CalendarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></svg>;
const ListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"></line><line x1="8" x2="21" y1="12" y2="12"></line><line x1="8" x2="21" y1="18" y2="18"></line><line x1="3" x2="3.01" y1="6" y2="6"></line><line x1="3" x2="3.01" y1="12" y2="12"></line><line x1="3" x2="3.01" y1="18" y2="18"></line></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>;
const ChevronLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>;
const ChevronRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>;
const BarChartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10"></line><line x1="18" x2="18" y1="20" y2="4"></line><line x1="6" x2="6" y1="20" y2="16"></line></svg>;
const MenuIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="12" y2="12"></line><line x1="3" x2="21" y1="6" y2="6"></line><line x1="3" x2="21" y1="18" y2="18"></line></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const LogOutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" x2="9" y1="12" y2="12"></line></svg>;
const CameraIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>;
const LoaderIcon = ({ color = 'text-white' }) => <svg className={`animate-spin ${color}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>;

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error: error }; }
  componentDidCatch(error, errorInfo) { console.error("Uncaught error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen text-center p-4">
          <div>
            <h1 className="text-2xl font-bold text-red-600">Qualcosa è andato storto.</h1>
            <p className="mt-2 text-gray-700">Si è verificato un errore che impedisce all'app di funzionare.</p>
            <pre className="mt-4 p-2 bg-gray-100 text-left text-sm text-red-700 rounded overflow-x-auto">{this.state.error && this.state.error.toString()}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

async function fetchData(sheetName) { const res = await fetch(`${SCRIPT_URL}?sheet=${sheetName}`); const result = await res.json(); if(result.error) throw new Error(result.error); return result.data; }
async function postData(action, data) { const res = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, data }) }); const result = await res.json(); if(result.error) throw new Error(result.error); return result; }

export default function App() { return <ErrorBoundary><ParkingApp /></ErrorBoundary>; }

function ParkingApp() {
    const [appState, setAppState] = useState('auth');
    const [isOperating, setIsOperating] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [parkingSpaces, setParkingSpaces] = useState([]);
    const [error, setError] = useState(null);

    const withOperation = async (operation) => {
        setIsOperating(true); setError(null);
        try { await operation(); } 
        catch (e) { setError(e.message); console.error(e); throw e; } 
        finally { setIsOperating(false); }
    };
    
    const handleLogin = (user) => withOperation(async () => {
        const [allUsersData, bookingsData, spacesData] = await Promise.all([fetchData('Users'), fetchData('Bookings'), fetchData('ParkingSpaces')]);
        const enrichedBookings = bookingsData.map(booking => ({ ...booking, user: allUsersData.find(u => u.id === booking.userId) || { firstName: 'Sconosciuto' } }));
        setAllUsers(allUsersData);
        setBookings(enrichedBookings);
        setParkingSpaces(spacesData);
        setCurrentUser(user);
        setAppState('logged_in');
    });

    const handleLogout = () => { setCurrentUser(null); setAllUsers([]); setBookings([]); setParkingSpaces([]); setAppState('auth'); };

    const handleUpdateUser = (updatedUserData) => withOperation(async () => {
        const result = await postData('updateUser', updatedUserData);
        setCurrentUser(result.data);
        setAllUsers(prev => prev.map(u => u.id === result.data.id ? result.data : u));
        setBookings(current => current.map(b => b.user && b.user.id === result.data.id ? { ...b, user: result.data } : b));
    });
    
    const handleAddBooking = (bookingData) => withOperation(async () => { 
        const result = await postData('addBooking', bookingData); 
        setBookings(prev => [...prev, { ...result.data, user: currentUser }]);
    });

    const handleDeleteBooking = (bookingId) => withOperation(async () => { 
        await postData('deleteBooking', { id: bookingId }); 
        setBookings(prev => prev.filter(b => b.id !== bookingId));
    });

    const handleAddParkingSpace = (spaceData) => withOperation(async () => { 
        const result = await postData('addParkingSpace', spaceData);
        setParkingSpaces(prev => [...prev, result.data]);
    });
    
    const handleDeleteParkingSpace = (spaceId) => withOperation(async () => {
        await postData('deleteParkingSpace', { id: spaceId });
        setParkingSpaces(prev => prev.filter(p => p.id !== spaceId));
    });

    if (appState === 'auth') {
        return <AuthScreen onLogin={handleLogin} error={error} setError={setError} />;
    }
    
    if (appState === 'logged_in') {
        return ( 
            <>
                <LoadingOverlay isLoading={isOperating} />
                <div className="bg-gray-100 min-h-screen font-sans">
                    <MainApp user={currentUser} allUsers={allUsers} bookings={bookings} parkingSpaces={parkingSpaces} onLogout={handleLogout} onUpdateUser={handleUpdateUser}
                        onAddBooking={handleAddBooking} onDeleteBooking={handleDeleteBooking} onAddParkingSpace={handleAddParkingSpace} onDeleteParkingSpace={handleDeleteParkingSpace} /> 
                </div> 
            </>
        );
    }
    return <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100"><LoaderIcon color="text-gray-500" /><p className="mt-4 text-gray-600">Avvio...</p></div>;
}

function AuthScreen({ onLogin, error, setError }) {
    const [authMode, setAuthMode] = useState('login');
    const [isOperating, setIsOperating] = useState(false);

    const handleAuthOperation = async (operation) => {
        setIsOperating(true); setError(null);
        try {
            const result = await operation();
            if (result && result.success) {
                onLogin(result.data);
            }
        } catch (e) {
            setError(e.message);
            console.error(e);
        } finally {
            setIsOperating(false);
        }
    };
    
    const onSignup = (data) => handleAuthOperation(() => postData('signup', data));
    const onLoginSubmit = (data) => handleAuthOperation(() => postData('login', data));

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="p-8 bg-white rounded-lg shadow-md w-full max-w-md relative">
                {isOperating && <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg"><LoaderIcon color="text-blue-600" /></div>}
                <h1 className="text-2xl font-bold mb-6 text-center">{authMode === 'login' ? 'Accedi' : 'Registrati'}</h1>
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</p>}
                {authMode === 'login' ? <LoginForm onSubmit={onLoginSubmit} onSwitchToSignup={() => { setAuthMode('signup'); setError(null); }} /> : <SignupForm onSubmit={onSignup} onSwitchToLogin={() => { setAuthMode('login'); setError(null); }} />}
            </div>
        </div>
    );
}

function LoginForm({ onSubmit, onSwitchToSignup }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); onSubmit({ email, password }); };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-sm font-medium">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded-lg mt-1" required /></div>
            <div><label className="block text-sm font-medium">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded-lg mt-1" required /></div>
            <button type="submit" className="w-full px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Accedi</button>
            <p className="text-center text-sm">Non hai un account? <button type="button" onClick={onSwitchToSignup} className="text-blue-600 hover:underline">Registrati</button></p>
        </form>
    );
}

function SignupForm({ onSubmit, onSwitchToLogin }) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); onSubmit({ firstName, lastName, email, password }); };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium">Nome</label><input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full p-2 border rounded-lg mt-1" required /></div>
                <div><label className="block text-sm font-medium">Cognome</label><input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full p-2 border rounded-lg mt-1" required /></div>
            </div>
            <div><label className="block text-sm font-medium">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded-lg mt-1" required /></div>
            <div><label className="block text-sm font-medium">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded-lg mt-1" required /></div>
            <button type="submit" className="w-full px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Registrati</button>
            <p className="text-center text-sm">Hai già un account? <button type="button" onClick={onSwitchToLogin} className="text-blue-600 hover:underline">Accedi</button></p>
        </form>
    );
}

const LoadingOverlay = ({ isLoading }) => {
    if (!isLoading) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
            <div className="text-white"><LoaderIcon /></div>
        </div>
    );
};
function MainApp({ user, allUsers, bookings, parkingSpaces, onLogout, onUpdateUser, onAddBooking, onUpdateBooking, onDeleteBooking, onAddParkingSpace, onDeleteParkingSpace }) {
    const [activeTab, setActiveTab] = useState('calendario');
    const [bookingModalInfo, setBookingModalInfo] = useState({ isOpen: false, date: null, booking: null });
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <header className="flex justify-between items-center mb-6 pb-4 border-b">
                <div><h1 className="text-2xl font-bold text-gray-800">Pannello Prenotazioni</h1><p className="text-sm text-gray-500 truncate">Accesso come: {user.firstName} {user.lastName}</p></div>
                <HamburgerMenu onLogout={onLogout} onProfileClick={() => setIsProfileModalOpen(true)} user={user} />
            </header>
            <div className="border-b mb-6"><div className="flex items-center space-x-2 -mb-px">
                <TabButton id="calendario" {...{ activeTab, setActiveTab }} icon={<CalendarIcon />}>Calendario</TabButton>
                <TabButton id="mie-prenotazioni" {...{ activeTab, setActiveTab }} icon={<ListIcon />}>Mie Prenotazioni</TabButton>
                <TabButton id="statistiche" {...{ activeTab, setActiveTab }} icon={<BarChartIcon />}>Statistiche</TabButton>
                <TabButton id="gestione-parcheggi" {...{ activeTab, setActiveTab }} icon={<SettingsIcon />}>Gestione</TabButton>
            </div></div>
            <main className="relative">
                {activeTab === 'calendario' && <CalendarView user={user} bookings={bookings} setModalInfo={setBookingModalInfo} />}
                {activeTab === 'mie-prenotazioni' && <MyBookingsView user={user} bookings={bookings} onDeleteBooking={onDeleteBooking} />}
                {activeTab === 'statistiche' && <StatisticsView bookings={bookings} allUsers={allUsers} />}
                {activeTab === 'gestione-parcheggi' && <ManageParkingView parkingSpaces={parkingSpaces} onAddParkingSpace={onAddParkingSpace} onDeleteParkingSpace={onDeleteParkingSpace} />}
                {activeTab === 'calendario' && (<button onClick={() => setBookingModalInfo({ isOpen: true, date: new Date(), booking: null })} className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-110" aria-label="Aggiungi prenotazione"><PlusIcon /></button>)}
            </main>
            {bookingModalInfo.isOpen && <BookingModal {...bookingModalInfo} onClose={() => setBookingModalInfo({ isOpen: false })} user={user} bookings={bookings} parkingSpaces={parkingSpaces} onAddBooking={onAddBooking} onUpdateBooking={onUpdateBooking} onDeleteBooking={onDeleteBooking} />}
            {isProfileModalOpen && <ProfileModal user={user} onSave={onUpdateUser} onClose={() => setIsProfileModalOpen(false)} />}
        </div>
    );
}
function HamburgerMenu({ onLogout, onProfileClick, user }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    useEffect(() => { const handleClickOutside = (event) => { if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false); }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, [menuRef]);
    return (
        <div className="relative" ref={menuRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-full hover:bg-gray-200 flex items-center space-x-2">
                <Avatar user={user} size="small" />
                <MenuIcon />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl z-50">
                    <div className="py-1">
                        <button onClick={() => { onProfileClick(); setIsOpen(false); }} className="flex items-center w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100"><UserIcon /><span className="ml-3">Gestisci Profilo</span></button>
                        <button onClick={onLogout} className="flex items-center w-full px-4 py-2 text-left text-red-600 hover:bg-gray-100"><LogOutIcon /><span className="ml-3">Logout</span></button>
                    </div>
                </div>
            )}
        </div>
    );
}
const TabButton = ({ id, activeTab, setActiveTab, children, icon }) => { const isActive = activeTab === id; return ( <button onClick={() => setActiveTab(id)} className={`flex items-center px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${isActive ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}> {icon} <span className={isActive ? 'ml-2' : 'hidden'}>{children}</span> </button> );};
const Avatar = ({ user, size = 'default' }) => {
    if (!user) return null;
    const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
    const sizeClasses = { small: 'w-8 h-8 text-xs', default: 'w-10 h-10 text-sm', large: 'w-24 h-24 text-2xl' };
    const baseClasses = `rounded-full flex items-center justify-center font-bold text-white`;
    const color = `bg-blue-500`;

    if (user.avatarUrl) {
        return <img src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} className={`${baseClasses} ${sizeClasses[size]} object-cover`} />;
    }
    return <div className={`${baseClasses} ${sizeClasses[size]} ${color}`}>{initials}</div>;
};
const formatDateToYYYYMMDD = (date) => { const d = new Date(date); const pad = (num) => num.toString().padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
function CalendarView({ user, bookings, setModalInfo }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const changeMonth = (offset) => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    const dayLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayOffset = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;

    const calendarDays = Array.from({ length: dayOffset + daysInMonth }, (_, i) => {
        if (i < dayOffset) return <div key={`empty-${i}`} className="border-r border-b"></div>;
        const dayNumber = i - dayOffset + 1;
        const dayDate = new Date(year, month, dayNumber);
        const dateString = formatDateToYYYYMMDD(dayDate);
        const isToday = formatDateToYYYYMMDD(new Date()) === dateString;
        const bookingsForDay = bookings.filter(b => b.date === dateString);
        return (
            <div key={dayNumber} onClick={() => setModalInfo({ isOpen: true, date: dayDate, booking: null })} className="relative p-2 border-r border-b min-h-[120px] flex flex-col hover:bg-gray-50 cursor-pointer">
                <time className={`font-semibold ${isToday ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>{dayNumber}</time>
                <div className="flex-grow mt-2 space-y-1 overflow-y-auto">
                    {bookingsForDay.map(b => (
                        <button key={b.id} onClick={(e) => { e.stopPropagation(); setModalInfo({ isOpen: true, date: dayDate, booking: b }); }} className={`w-full text-left text-xs p-1 rounded-md truncate ${b.user && b.user.id === user.id ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                            P: {b.parkingSpaceNumber}
                        </button>
                    ))}
                </div>
            </div>
        );
    });

    return (<div className="bg-white p-4 sm:p-6 rounded-lg shadow-md"><div className="flex justify-between items-center mb-4"><button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-200"><ChevronLeftIcon /></button><h2 className="text-xl font-bold">{currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}</h2><button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-200"><ChevronRightIcon /></button></div><div className="grid grid-cols-7 text-center font-semibold text-gray-600">{dayLabels.map(l => <div key={l} className="py-2 border-b-2">{l}</div>)}</div><div className="grid grid-cols-7 border-l border-t">{calendarDays}</div></div>);
}
function MyBookingsView({ user, bookings, onDeleteBooking }) {
    const myBookings = bookings.filter(b => b.user && b.user.id === user.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!myBookings.length) return <div className="text-center p-8 bg-white rounded-lg shadow-md"><p>Non hai prenotazioni attive.</p></div>;
    return (<div className="bg-white p-6 rounded-lg shadow-md"><h2 className="text-xl font-bold mb-4">Le tue prenotazioni</h2><div className="space-y-4">{myBookings.map(b => (<div key={b.id} className="flex justify-between items-center p-4 border rounded-lg"><div><p className="font-semibold">Parcheggio: <span className="text-blue-600">{b.parkingSpaceNumber}</span></p><p className="text-sm text-gray-600">Data: {new Date(b.date+'T12:00:00Z').toLocaleDateString('it-IT', {dateStyle: 'full'})}</p></div><button onClick={() => onDeleteBooking(b.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full"><TrashIcon /></button></div>))}</div></div>);
}
function StatisticsView({ bookings, allUsers }) { 
    const stats = allUsers.map(u => { 
        const userBookings = bookings.filter(b => b.user && b.user.id === u.id); 
        const spotCounts = userBookings.reduce((acc,b) => { acc[b.parkingSpaceNumber] = (acc[b.parkingSpaceNumber] || 0) + 1; return acc; }, {}); 
        return { user: u, totalBookings: userBookings.length, spotCounts: Object.entries(spotCounts) }; 
    }); 
    return ( 
        <div className="bg-white p-6 rounded-lg shadow-md"> 
            <h2 className="text-xl font-bold mb-6">Statistiche Utenti</h2> 
            <div className="space-y-6"> 
                {stats.map(({ user, totalBookings, spotCounts }) => ( 
                    <div key={user.id} className="p-4 border rounded-lg"> 
                        <h3 className="font-bold text-lg text-gray-800">{user.firstName} {user.lastName}</h3> 
                        <p className="text-sm text-gray-600 mt-1">Prenotazioni totali: <span className="font-semibold text-blue-600">{totalBookings}</span></p> 
                        {totalBookings > 0 && ( <div className="mt-3"> <h4 className="font-semibold text-sm">Parcheggi utilizzati:</h4> <ul className="list-disc list-inside mt-2 space-y-1 text-sm"> {spotCounts.map(([spot, count]) => ( <li key={spot}>{spot}: <span className="font-semibold">{count}</span> volta/e</li> ))} </ul> </div> )} 
                    </div> 
                ))} 
            </div> 
        </div> 
    ); 
}
function ManageParkingView({ parkingSpaces, onAddParkingSpace, onDeleteParkingSpace }) { 
    const [newSpace, setNewSpace] = useState(''); 
    const handleAdd = (e) => { e.preventDefault(); if (newSpace.trim()) { onAddParkingSpace({ number: newSpace.trim() }); setNewSpace(''); } }; 
    return (<div className="bg-white p-6 rounded-lg shadow-md"><h2 className="text-xl font-bold mb-4">Gestisci Parcheggi</h2><form onSubmit={handleAdd} className="flex space-x-2 mb-6"><input type="text" value={newSpace} onChange={e => setNewSpace(e.target.value)} placeholder="Es. 13A" className="flex-grow p-2 border rounded-lg" /><button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg">Aggiungi</button></form><div className="space-y-2">{parkingSpaces.map(s => (<div key={s.id} className="flex justify-between items-center p-3 border rounded-lg"><span className="font-medium">{s.number}</span><button onClick={() => onDeleteParkingSpace(s.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full"><TrashIcon /></button></div>))}{!parkingSpaces.length && <p className="text-center text-gray-500 py-4">Nessun parcheggio configurato.</p>}</div></div>); 
}
function BookingModal({ isOpen, onClose, date, booking, user, bookings, parkingSpaces, onAddBooking, onUpdateBooking, onDeleteBooking }) {
    const isEditing = !!booking;
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSpace, setSelectedSpace] = useState('');
    useEffect(() => { const initialDate = booking ? booking.date : formatDateToYYYYMMDD(date || new Date()); setSelectedDate(initialDate); setSelectedSpace(booking ? booking.parkingSpaceId : ''); }, [isOpen, date, booking]);
    const availableSpaces = parkingSpaces.filter(p => !bookings.some(b => b.date === selectedDate && b.parkingSpaceId === p.id) || (isEditing && p.id === booking.parkingSpaceId));
    const handleSubmit = (e) => { e.preventDefault(); const spaceDetails = parkingSpaces.find(p => p.id === selectedSpace); if(!spaceDetails) return; const data = { userId: user.id, date: selectedDate, parkingSpaceId: selectedSpace, parkingSpaceNumber: spaceDetails.number }; if (isEditing) { onUpdateBooking(booking.id, { id: booking.id, ...data }); } else { onAddBooking(data); } onClose(); };
    const handleDelete = () => { onDeleteBooking(booking.id); onClose(); };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md"><div className="flex justify-between items-center p-4 border-b"><h3 className="text-xl font-bold">{isEditing ? 'Dettagli Prenotazione' : 'Nuova Prenotazione'}</h3><button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><CloseIcon /></button></div>
        <div className="p-6">
            {isEditing && booking.user && ( <div className="mb-4 flex items-center space-x-3"> <Avatar user={booking.user} /> <div> <label className="block text-sm font-medium text-gray-500">Prenotato da</label> <p className="text-lg font-semibold text-gray-800">{booking.user.firstName} {booking.user.lastName}</p> </div> </div> )}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label htmlFor="date" className="block text-sm font-medium mb-1">Data</label><input id="date" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full p-2 border rounded-lg" required/></div>
                {(!isEditing || (booking.user && booking.user.id === user.id)) && ( <div><label htmlFor="parkingSpace" className="block text-sm font-medium mb-1">Parcheggio</label><select id="parkingSpace" value={selectedSpace} onChange={e => setSelectedSpace(e.target.value)} className="w-full p-2 border rounded-lg" required><option value="">-- Seleziona --</option>{availableSpaces.map(s => <option key={s.id} value={s.id}>{s.number}</option>)}</select>{availableSpaces.length === 0 && !isEditing && <p className="text-xs text-yellow-600 mt-1">Nessun parcheggio disponibile.</p>}</div> )}
                <div className="flex justify-end items-center pt-4 space-x-3">
                    {isEditing && booking.user && booking.user.id === user.id && <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Elimina</button>}
                    {(!isEditing || (booking.user && booking.user.id === user.id)) && <button type="submit" disabled={!selectedSpace} className="px-6 py-2 font-semibold text-white bg-blue-600 rounded-lg disabled:bg-gray-400 hover:bg-blue-700">{isEditing ? 'Salva Modifiche' : 'Prenota'}</button>}
                </div>
            </form>
        </div>
        </div></div>
    );
}
function ProfileModal({ user, onSave, onClose }) {
    const [formData, setFormData] = useState({ ...user, newPassword: '', confirmPassword: '' });
    const fileInputRef = useRef(null);
    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) { const reader = new FileReader(); reader.onloadend = () => { setFormData({ ...formData, avatarUrl: reader.result }); }; reader.readAsDataURL(file); }
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.newPassword && formData.newPassword !== formData.confirmPassword) { alert("Le password non coincidono."); return; }
        
        const userDataToSave = { ...formData };
        if (!formData.newPassword) {
            delete userDataToSave.newPassword;
        }
        delete userDataToSave.confirmPassword;
        
        onSave(userDataToSave);
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md"><div className="flex justify-between items-center p-4 border-b"><h3 className="text-xl font-bold">Gestisci Profilo</h3><button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><CloseIcon /></button></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex flex-col items-center space-y-2"><div className="relative"><Avatar user={formData} size="large" /><input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" /><button type="button" onClick={() => fileInputRef.current.click()} className="absolute bottom-0 right-0 bg-white p-1 rounded-full shadow border"><CameraIcon /></button></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium">Nome</label><input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1" /></div>
                <div><label className="block text-sm font-medium">Cognome</label><input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1" /></div>
            </div>
            <div><label className="block text-sm font-medium">Email</label><input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1" /></div>
            <div><label className="block text-sm font-medium">Nuova Password</label><input type="password" name="newPassword" value={formData.newPassword} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1" placeholder="Lascia vuoto per non cambiare" /></div>
            <div><label className="block text-sm font-medium">Conferma Password</label><input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1" /></div>
            <div className="flex justify-end pt-4"><button type="submit" className="px-6 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Salva Modifiche</button></div>
        </form>
        </div></div>
    );
}


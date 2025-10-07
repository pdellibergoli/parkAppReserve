import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layout
import MainLayout from './layouts/MainLayout';

// Pagine
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import RequestPasswordResetPage from './pages/RequestPasswordResetPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import HomePage from './pages/HomePage';
import MyBookingsPage from './pages/MyBookingsPage';
import ParkingSpacesPage from './pages/ParkingSpacesPage';
import StatsPage from './pages/StatsPage';
import ProfilePage from './pages/ProfilePage';
import FulfillRequestPage from './pages/FulfillRequestPage';

// --- MODIFICA 1: Rinominiamo la vecchia ProtectedRoute in LayoutRoute ---
// La sua unica responsabilità è mostrare il layout principale se l'utente è loggato.
function LayoutRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  return isAuthenticated 
    ? <MainLayout /> 
    : <Navigate to="/login" state={{ from: location }} replace />;
}

// --- MODIFICA 2: Creiamo una nuova ProtectedRoute più generica ---
// Questa protegge un componente senza forzarlo dentro il MainLayout.
// Mostra il componente (children) solo se l'utente è loggato.
function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    return isAuthenticated
        ? children
        : <Navigate to="/login" state={{ from: location }} replace />;
}


// Componente per le rotte pubbliche (login/signup)
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    // Controlla se siamo stati reindirizzati qui da una pagina protetta.
    // Se 'location.state.from' esiste, significa che dobbiamo tornare lì.
    const from = location.state?.from?.pathname + (location.state?.from?.search || '');
    
    // Se 'from' esiste, naviga lì. Altrimenti, vai alla homepage di default.
    return <Navigate to={from || '/'} replace />;
  }

  return children;
}


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotte Pubbliche */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
          <Route path="/verify-email" element={<PublicRoute><VerifyEmailPage /></PublicRoute>} />
          <Route path="/request-reset" element={<PublicRoute><RequestPasswordResetPage /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

          {/* --- MODIFICA 3: Rotte protette DENTRO il layout principale --- */}
          <Route element={<LayoutRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="my-bookings" element={<MyBookingsPage />} />
            <Route path="parking-spaces" element={<ParkingSpacesPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* --- MODIFICA 4: Rotta protetta FUORI dal layout principale --- */}
          {/* La pagina FulfillRequestPage ora usa la nuova ProtectedRoute */}
          <Route 
            path="/fulfill-request" 
            element={
              <ProtectedRoute>
                <FulfillRequestPage />
              </ProtectedRoute>
            } 
          />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
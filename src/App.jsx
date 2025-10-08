import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoadingProvider } from './context/LoadingContext';
import LoadingOverlay from './components/LoadingOverlay';

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


function LayoutRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  return isAuthenticated 
    ? <MainLayout /> 
    : <Navigate to="/login" state={{ from: location }} replace />;
}

function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    return isAuthenticated
        ? children
        : <Navigate to="/login" state={{ from: location }} replace />;
}


// --- MODIFICA QUI ---
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    // Logica corretta e più sicura:
    // 1. Inizializza il percorso di default alla homepage.
    let from = '/'; 
    
    // 2. Se esiste uno stato 'from' (perché veniamo da una pagina protetta), costruisci l'URL completo.
    if (location.state?.from) {
      from = location.state.from.pathname + (location.state.from.search || '');
    }
    
    // 3. Reindirizza al percorso corretto.
    return <Navigate to={from} replace />;
  }

  return children;
}


function App() {
  return (
    <AuthProvider>
      <LoadingProvider>
        <Router>
          <LoadingOverlay />
          <Routes>
            {/* Rotte Pubbliche */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
            <Route path="/verify-email" element={<PublicRoute><VerifyEmailPage /></PublicRoute>} />
            <Route path="/request-reset" element={<PublicRoute><RequestPasswordResetPage /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

            {/* Rotte protette DENTRO il layout principale */}
            <Route element={<LayoutRoute />}>
              <Route path="/" element={<HomePage />} />
              <Route path="my-bookings" element={<MyBookingsPage />} />
              <Route path="parking-spaces" element={<ParkingSpacesPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Rotta protetta FUORI dal layout principale */}
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
      </LoadingProvider>
    </AuthProvider>
  );
}

export default App;
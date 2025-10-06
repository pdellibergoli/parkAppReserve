import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
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

// Componente per proteggere le rotte
function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  // Se l'utente è autenticato, mostra il layout principale che a sua volta
  // mostrerà la pagina richiesta. Altrimenti, reindirizza al login.
  return isAuthenticated ? <MainLayout /> : <Navigate to="/login" />;
}

// Componente per le rotte pubbliche (login/signup)
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? children : <Navigate to="/" />;
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
          {/* Rotte Protette */}
          <Route path="/" element={<ProtectedRoute />}>
            <Route index element={<HomePage />} />
            <Route path="my-bookings" element={<MyBookingsPage />} />
            <Route path="parking-spaces" element={<ParkingSpacesPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoadingProvider } from './context/LoadingContext';
import { ThemeProvider } from './context/ThemeContext';
import LoadingOverlay from './components/LoadingOverlay';

// Layout
import MainLayout from './layouts/MainLayout';

// Chi ha già una sessione attiva non le apre mai: non pesano sul suo primo caricamento
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const RequestPasswordResetPage = lazy(() => import('./pages/RequestPasswordResetPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

// Pagine protette: caricate su richiesta (calendar, day-picker e grafici
// finiscono in chunk separati e non rallentano il primo caricamento)
const HomePage = lazy(() => import('./pages/HomePage'));
const MyRequestsPage = lazy(() => import('./pages/MyRequestsPage'));
const ParkingSpacesPage = lazy(() => import('./pages/ParkingSpacesPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FulfillRequestPage = lazy(() => import('./pages/FulfillRequestPage'));


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

const RouteFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '10vh 0' }}>
    <div className="spinner" />
  </div>
);


function App() {
  return (
    <AuthProvider>
      <LoadingProvider>
        <ThemeProvider>
          <Router>
            <LoadingOverlay />
            <Suspense fallback={<RouteFallback />}>
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
                  <Route path="my-requests" element={<MyRequestsPage />} />
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
            </Suspense>
          </Router>
        </ThemeProvider>
      </LoadingProvider>
    </AuthProvider>
  );
}

export default App;

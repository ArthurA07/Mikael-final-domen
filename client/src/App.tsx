import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { UserProvider } from './contexts/UserContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import Loading from './components/common/Loading';
import NotFound from './pages/NotFound';
const LegalPrivacy = lazy(() => import('./pages/LegalPrivacy'));
const LegalDataConsent = lazy(() => import('./pages/LegalDataConsent'));
const LegalUserAgreement = lazy(() => import('./pages/LegalUserAgreement'));
const LegalPublicOffer = lazy(() => import('./pages/LegalPublicOffer'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const TrainerPage = lazy(() => import('./pages/trainer/TrainerPage'));
const AbacusPage = lazy(() => import('./pages/abacus/AbacusPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const AchievementsPage = lazy(() => import('./pages/achievements/AchievementsPage'));
const StatsPage = lazy(() => import('./pages/stats/StatsPage'));
const HistoryPage = lazy(() => import('./pages/stats/HistoryPage'));
const TrainingDetailPage = lazy(() => import('./pages/stats/TrainingDetailPage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));
const AboutTrainer = lazy(() => import('./pages/AboutTrainer'));

// Создаём тему для приложения
const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
      light: '#8fa3f0',
      dark: '#4a58a3',
    },
    secondary: {
      main: '#FF6B6B',
      light: '#ff8a80',
      dark: '#f44336',
    },
    success: {
      main: '#4ECDC4',
      light: '#80cbc4',
      dark: '#00695c',
    },
    warning: {
      main: '#FFD93D',
      light: '#ffeb3b',
      dark: '#f57f17',
    },
    error: {
      main: '#FF6B6B',
      light: '#ffab91',
      dark: '#d32f2f',
    },
    info: {
      main: '#45B7D1',
      light: '#81c784',
      dark: '#1976d2',
    },
    background: {
      default: '#F8F9FA',
      paper: '#ffffff',
    },
    text: {
      primary: '#2c3e50',
      secondary: '#7f8c8d',
    },
  },
  typography: {
    fontFamily: [
      'Comic Neue',
      'Nunito',
      'Poppins',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '3rem',
      fontWeight: 700,
      color: '#2c3e50',
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2.5rem',
      fontWeight: 700,
      color: '#2c3e50',
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '2rem',
      fontWeight: 600,
      color: '#2c3e50',
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.75rem',
      fontWeight: 600,
      color: '#2c3e50',
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: '#2c3e50',
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: '#2c3e50',
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: '#2c3e50',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: '#7f8c8d',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '1rem',
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '25px',
          textTransform: 'none',
          fontWeight: 600,
          padding: '12px 24px',
          fontSize: '1rem',
          boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          },
        },
        contained: {
          background: 'linear-gradient(45deg, #667eea, #764ba2)',
          color: 'white',
          '&:hover': {
            background: 'linear-gradient(45deg, #8fa3f0, #9575cd)',
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
            backgroundColor: 'rgba(102, 126, 234, 0.04)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.05)',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '15px',
            backgroundColor: '#f8f9fa',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: '#ffffff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            },
            '&.Mui-focused': {
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '20px',
          fontWeight: 600,
          fontSize: '0.875rem',
        },
        colorPrimary: {
          background: 'linear-gradient(45deg, #667eea, #764ba2)',
          color: 'white',
        },
        colorSecondary: {
          background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
          color: 'white',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
          color: '#2c3e50',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          margin: '4px 0',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(102, 126, 234, 0.08)',
            transform: 'translateX(4px)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          transition: 'all 0.3s ease',
          '&:hover': {
            backgroundColor: 'rgba(102, 126, 234, 0.08)',
            transform: 'scale(1.05)',
          },
        },
      },
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <UserProvider>
          <Router>
            <div className="App">
              <Navbar />
              <ErrorBoundary>
              <Routes>
                <Route path="*" element={<Suspense fallback={<Loading />}><Navigate to="/404" replace /></Suspense>} />
                {/* Публичные маршруты */}
                <Route path="/" element={<Suspense fallback={<Loading />}><HomePage /></Suspense>} />
                <Route path="/login" element={<Suspense fallback={<Loading />}><LoginPage /></Suspense>} />
                <Route path="/register" element={<Suspense fallback={<Loading />}><RegisterPage /></Suspense>} />
                <Route path="/pricing" element={<Suspense fallback={<Loading />}><PricingPage /></Suspense>} />
                <Route path="/forgot-password" element={<Suspense fallback={<Loading />}><ForgotPassword /></Suspense>} />
                <Route path="/reset-password" element={<Suspense fallback={<Loading />}><ResetPassword /></Suspense>} />
                <Route path="/privacy" element={<Suspense fallback={<Loading />}><LegalPrivacy /></Suspense>} />
                <Route path="/data-consent" element={<Suspense fallback={<Loading />}><LegalDataConsent /></Suspense>} />
                <Route path="/user-agreement" element={<Suspense fallback={<Loading />}><LegalUserAgreement /></Suspense>} />
                <Route path="/public-offer" element={<Suspense fallback={<Loading />}><LegalPublicOffer /></Suspense>} />
                <Route path="/about" element={<Suspense fallback={<Loading />}><AboutTrainer /></Suspense>} />
                <Route path="/404" element={<NotFound />} />
                
                {/* Защищённые маршруты */}
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading />}><Dashboard /></Suspense>
                  </ProtectedRoute>
                } />
                <Route path="/trainer" element={<Suspense fallback={<Loading />}><TrainerPage /></Suspense>} />
                <Route path="/abacus" element={<Suspense fallback={<Loading />}><AbacusPage /></Suspense>} />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading />}><ProfilePage /></Suspense>
                  </ProtectedRoute>
                } />
                <Route path="/achievements" element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading />}><AchievementsPage /></Suspense>
                  </ProtectedRoute>
                } />
                <Route path="/stats" element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading />}><StatsPage /></Suspense>
                  </ProtectedRoute>
                } />
                <Route path="/stats/history" element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading />}><HistoryPage /></Suspense>
                  </ProtectedRoute>
                } />
                <Route path="/stats/history/:id" element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading />}><TrainingDetailPage /></Suspense>
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading />}><AdminPage /></Suspense>
                  </ProtectedRoute>
                } />
                
              </Routes>
              </ErrorBoundary>
              <Footer />
            </div>
          </Router>
        </UserProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

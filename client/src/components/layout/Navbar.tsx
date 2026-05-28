import React, { useEffect, useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  useMediaQuery,
  useTheme,
  Avatar,
  Menu,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home,
  Calculate,
  ViewModule,
  EmojiEvents,
  BarChart,
  Person,
  Login,
  PersonAdd,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

type SubscriptionStatus = 'demo' | 'active' | 'expired' | 'canceled';

interface SubscriptionInfo {
  status?: SubscriptionStatus;
  paidUntil?: string | null;
}

const Navbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    const loadSubscription = async () => {
      if (!isAuthenticated) {
        setSubscription(null);
        return;
      }

      try {
        const response = await axios.get('/payments/subscription');
        setSubscription(response?.data?.data?.subscription || null);
      } catch {
        setSubscription(null);
      }
    };

    loadSubscription();
  }, [isAuthenticated]);

  const subscriptionStatus = subscription?.status || 'demo';
  const isSubscriptionActive =
    subscriptionStatus === 'active' &&
    (!subscription?.paidUntil || new Date(subscription.paidUntil).getTime() > Date.now());
  const isDemoAccess = subscriptionStatus === 'demo';
  const subscriptionBadgeLabel = isSubscriptionActive
    ? '✨ Подписка активна'
    : (isDemoAccess ? '🟢 Демо-доступ активен' : '💳 Подписка не активна');
  const subscriptionMenuLabel = isSubscriptionActive
    ? '💳 Подписка: активна'
    : (isDemoAccess ? '🟢 Гостевой режим (демо)' : '💳 Подписка: не активна');

  const menuItems = [
    { text: '🏠 Главная', path: '/', icon: <Home />, public: true },
    { text: '📊 Панель', path: '/dashboard', icon: <DashboardIcon />, public: false },
    { text: '🎯 Тренажёр', path: '/trainer', icon: <Calculate />, public: true },
    { text: '🧮 Абакус', path: '/abacus', icon: <ViewModule />, public: true },
    { text: 'ℹ️ О тренажёре', path: '/about', icon: <EmojiEvents />, public: true },
    { text: '📜 История', path: '/stats/history', icon: <BarChart />, public: false },
    { text: '🏆 Достижения', path: '/achievements', icon: <EmojiEvents />, public: false },
    { text: '📈 Статистика', path: '/stats', icon: <BarChart />, public: false },
    { text: '👤 Профиль', path: '/profile', icon: <Person />, public: false },
    ...(user?.role === 'admin' ? [{ text: '🛡️ Админ', path: '/admin', icon: <DashboardIcon />, public: false }] : []),
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    handleMenuClose();
    navigate('/');
  };

  const getActiveItemStyle = (path: string) => ({
    backgroundColor: location.pathname === path ? 'rgba(255, 107, 107, 0.1)' : 'transparent',
    borderRadius: '15px',
    margin: '4px 8px',
    border: location.pathname === path ? '2px solid #FF6B6B' : '2px solid transparent',
    transform: location.pathname === path ? 'scale(1.02)' : 'scale(1)',
    transition: 'all 0.3s ease',
    '&:hover': {
      backgroundColor: 'rgba(102, 126, 234, 0.1)',
      transform: 'scale(1.05) translateX(8px)',
    },
  });

  const drawer = (
    <Box 
      sx={{ 
        width: 280,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        height: '100%',
        color: 'white',
      }}
    >
      <Box 
        sx={{ 
          p: 3, 
          textAlign: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        <Typography 
          variant="h5" 
          sx={{ 
            fontWeight: 700,
            background: 'linear-gradient(45deg, #FFD700, #FFA500)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))',
          }}
        >
          🧮 Супер Математика
        </Typography>
      </Box>
      
      <List sx={{ pt: 2 }}>
        {menuItems
          .filter(item => item.public || isAuthenticated)
          .map((item) => (
            <ListItem
              key={item.text}
              component="div"
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                ...getActiveItemStyle(item.path),
                cursor: 'pointer',
              }}
            >
              <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text}
                primaryTypographyProps={{
                  fontWeight: location.pathname === item.path ? 700 : 500,
                  fontSize: '1rem',
                }}
              />
            </ListItem>
          ))}
        
        {!isAuthenticated && (
          <>
            <Box sx={{ mx: 2, my: 2, height: '1px', bgcolor: 'rgba(255,255,255,0.2)' }} />
            <ListItem
              component="div"
              onClick={() => {
                navigate('/login');
                setMobileOpen(false);
              }}
              sx={{
                ...getActiveItemStyle('/login'),
                cursor: 'pointer',
              }}
            >
              <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                <Login />
              </ListItemIcon>
              <ListItemText 
                primary="🔑 Войти"
                primaryTypographyProps={{
                  fontWeight: 500,
                  fontSize: '1rem',
                }}
              />
            </ListItem>
            <ListItem
              component="div"
              onClick={() => {
                navigate('/register');
                setMobileOpen(false);
              }}
              sx={{
                ...getActiveItemStyle('/register'),
                cursor: 'pointer',
              }}
            >
              <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                <PersonAdd />
              </ListItemIcon>
              <ListItemText 
                primary="🎓 Регистрация"
                primaryTypographyProps={{
                  fontWeight: 500,
                  fontSize: '1rem',
                }}
              />
            </ListItem>
          </>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar 
        position="sticky" 
        elevation={0}
        sx={{
          backgroundColor: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        <Toolbar
          sx={
            isMobile
              ? { py: 1, gap: 1, minHeight: 72 }
              : {
                  py: 1.25,
                  minHeight: 84,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                  alignItems: 'center',
                  columnGap: 2,
                }
          }
        >
          {/* Logo и название */}
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              flex: isMobile ? '1 1 auto' : undefined,
              minWidth: 0,
              maxWidth: isMobile ? 'none' : '100%',
              justifySelf: isMobile ? 'auto' : 'start',
              cursor: 'pointer',
              transition: 'transform 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)',
              },
            }}
            onClick={() => navigate('/')}
          >
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 700,
                fontSize: { xs: '1.2rem', md: '1.5rem' },
                background: 'linear-gradient(45deg, #667eea, #764ba2)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mr: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: { xs: '56vw', sm: '44vw', md: '32vw', lg: 'none' },
              }}
            >
              🧮 Супер Математика
            </Typography>
            {isAuthenticated && (
              <Chip
                label={subscriptionBadgeLabel}
                size="small"
                sx={{
                  background: isSubscriptionActive
                    ? 'linear-gradient(45deg, #4ECDC4, #45B7D1)'
                    : 'linear-gradient(45deg, #f59e0b, #f97316)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
              />
            )}
          </Box>

          {/* Десктопное меню */}
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, justifySelf: 'center' }}>
              {menuItems
                .filter(item => item.public || isAuthenticated)
                .slice(0, 4) // Показываем только первые 4 пункта
                .map((item) => (
                  <Button
                    key={item.text}
                    onClick={() => navigate(item.path)}
                    sx={{
                      color: location.pathname === item.path ? '#FF6B6B' : '#2c3e50',
                      fontWeight: location.pathname === item.path ? 700 : 500,
                      backgroundColor: location.pathname === item.path ? 'rgba(255, 107, 107, 0.1)' : 'transparent',
                      borderRadius: '20px',
                      px: 3,
                      py: 1.15,
                      minHeight: 42,
                      lineHeight: 1.2,
                      fontSize: '0.95rem',
                      textTransform: 'none',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    {item.text}
                  </Button>
                ))}
            </Box>
          )}

          {/* Правая часть */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
              justifySelf: isMobile ? 'auto' : 'end',
              justifyContent: 'flex-end',
              minWidth: isMobile ? 0 : 220,
            }}
          >
            {!isMobile && (
              <>
                {isAuthenticated ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={`👋 Привет, ${user?.name?.split(' ')[0] || 'Ученик'}!`}
                      sx={{
                        background: 'linear-gradient(45deg, #667eea, #764ba2)',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    />
                    <IconButton
                      onClick={handleMenuClick}
                      sx={{
                        border: '2px solid #667eea',
                        '&:hover': {
                          transform: 'scale(1.1)',
                        },
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
                          fontSize: '1rem',
                          fontWeight: 700,
                        }}
                      >
                        {user?.name?.charAt(0) || '🙂'}
                      </Avatar>
                    </IconButton>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      onClick={() => navigate('/login')}
                      variant="outlined"
                      size="small"
                      sx={{
                        borderRadius: '20px',
                        px: 3,
                        fontWeight: 600,
                        textTransform: 'none',
                      }}
                    >
                      🔑 Войти
                    </Button>
                    <Button
                      onClick={() => navigate('/register')}
                      variant="contained"
                      size="small"
                      sx={{
                        borderRadius: '20px',
                        px: 3,
                        fontWeight: 600,
                        textTransform: 'none',
                        background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
                      }}
                    >
                      🎓 Регистрация
                    </Button>
                  </Box>
                )}
              </>
            )}

            {/* Мобильное меню */}
            {isMobile && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="end"
                onClick={handleDrawerToggle}
                sx={{
                  color: '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: '12px',
                  '&:hover': {
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    transform: 'scale(1.1)',
                  },
                }}
              >
                <MenuIcon />
              </IconButton>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Мобильное боковое меню */}
      <Drawer
        variant="temporary"
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 280,
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Меню профиля */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            borderRadius: '15px',
            mt: 1,
            minWidth: 200,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          },
        }}
      >
        <MenuItem 
          onClick={() => {
            navigate('/profile');
            handleMenuClose();
          }}
          sx={{
            borderRadius: '10px',
            mx: 1,
            my: 0.5,
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          👤 Мой профиль
        </MenuItem>
        <MenuItem 
          onClick={() => {
            navigate('/pricing');
            handleMenuClose();
          }}
          sx={{
            borderRadius: '10px',
            mx: 1,
            my: 0.5,
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          {subscriptionMenuLabel}
        </MenuItem>
        <MenuItem 
          onClick={() => {
            navigate('/stats');
            handleMenuClose();
          }}
          sx={{
            borderRadius: '10px',
            mx: 1,
            my: 0.5,
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          📊 Моя статистика
        </MenuItem>
        {user?.role === 'admin' && (
          <MenuItem 
            onClick={() => {
              navigate('/admin');
              handleMenuClose();
            }}
            sx={{
              borderRadius: '10px',
              mx: 1,
              my: 0.5,
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            🛡️ Админ
          </MenuItem>
        )}
        <MenuItem 
          onClick={handleLogout}
          sx={{
            borderRadius: '10px',
            mx: 1,
            my: 0.5,
            color: '#FFB3B3',
            '&:hover': {
              backgroundColor: 'rgba(255,179,179,0.2)',
            },
          }}
        >
          🚪 Выйти
        </MenuItem>
      </Menu>
    </>
  );
};

export default Navbar; 
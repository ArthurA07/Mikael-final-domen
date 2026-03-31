import React, { useEffect, useState } from 'react';
import { Box, Typography, Container, Paper, CircularProgress, Button } from '@mui/material';
import InteractiveAbacus from '../../components/abacus/InteractiveAbacus';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AbacusPage: React.FC = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [used, setUsed] = useState<number | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        // Публичная проверка: для авторизованных всегда true, для гостей — 20 минут по IP
        const res = await axios.post('/public/free-access');
        if (res.data?.success && res.data?.data?.allowed) {
          setAllowed(true);
          setExpiresAt(res.data.data.expiresAt || null);
          if (typeof res.data.data.exercisesUsed === 'number') setUsed(res.data.data.exercisesUsed);
        } else {
          setAllowed(false);
        }
      } catch (e) {
        setAllowed(false);
      } finally {
        setChecking(false);
      }
    };
    check();
  }, []);

  if (checking) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!allowed) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Бесплатный доступ к абакусу уже использован
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Вы можете оформить доступ в тарифах и продолжить занятия без ограничений.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/pricing')}>Перейти к тарифам</Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Время окончания сессии */}
      {expiresAt && (
        <Paper elevation={2} sx={{ p: 2, mb: 2, textAlign: 'center' }}>
          <Typography variant="body2">Бесплатный доступ активен до: {new Date(expiresAt).toLocaleTimeString()}{used !== null ? ` · Использовано: ${used}` : ''}</Typography>
        </Paper>
      )}
      {/* Описание и сам абакус */}
      <Paper 
        elevation={3} 
        sx={{ 
          p: 3, 
          mb: 4, 
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          textAlign: 'center',
        }}
      >
        <Typography 
          variant="h3" 
          component="h1" 
          gutterBottom
          sx={{ 
            fontWeight: 700,
            fontSize: { xs: '2rem', md: '3rem' },
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          🧮 Виртуальный Абакус
        </Typography>
        <Typography variant="h6" sx={{ opacity: 0.9, maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
          Изучайте основы ментальной арифметики с помощью интерактивного соробана. 
        </Typography>
      </Paper>

      <InteractiveAbacus />
    </Container>
  );
};

export default AbacusPage;

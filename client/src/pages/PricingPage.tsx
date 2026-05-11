import React, { useState } from 'react';
import { useSeo } from '../utils/seo';
import {
  Container,
  Typography,
  Paper,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const tariffRows = [
  { months: 1, period: '1 месяц', price: '399 рублей' },
  { months: 3, period: '3 месяца', price: '999 рублей' },
  { months: 6, period: '6 месяцев', price: '1799 рублей' },
  { months: 12, period: '12 месяцев', price: '2999 рублей' },
];

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [loadingMonths, setLoadingMonths] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  useSeo({
    title: 'Тарифы — Супер Математика',
    description: 'Выберите подходящий тариф тренажёра ментальной арифметики. Доступ к тренажёрам и абакусу.',
  });

  const handleBuy = async (months: number) => {
    setErrorMessage('');
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      setLoadingMonths(months);
      const response = await axios.post('/payments/yookassa/create', { periodMonths: months });
      const confirmationUrl = response?.data?.data?.confirmationUrl;
      if (!confirmationUrl) {
        throw new Error('Не получена ссылка на оплату');
      }
      window.location.assign(confirmationUrl);
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Не удалось создать платеж';
      setErrorMessage(message);
    } finally {
      setLoadingMonths(null);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>Тарифы</Typography>
        <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 3 }}>
          Выберите подходящий период подписки. Полные условия оплаты и возврата доступны в пользовательском соглашении.
        </Typography>
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table aria-label="Тарифы подписки">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Период подписки</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Стоимость подписки</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Оплата</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tariffRows.map((row) => (
                <TableRow key={row.period}>
                  <TableCell>{row.period}</TableCell>
                  <TableCell>{row.price}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleBuy(row.months)}
                      disabled={loadingMonths !== null}
                    >
                      {loadingMonths === row.months ? <CircularProgress size={18} color="inherit" /> : 'Оплатить'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="contained" onClick={() => navigate('/register')}>Зарегистрироваться</Button>
          <Button variant="outlined" onClick={() => navigate('/login')}>Войти</Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default PricingPage; 
import React from 'react';
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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const tariffRows = [
  { period: '1 месяц', price: '399 рублей' },
  { period: '3 месяца', price: '999 рублей' },
  { period: '6 месяцев', price: '1799 рублей' },
  { period: '12 месяцев', price: '2999 рублей' },
];

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  useSeo({
    title: 'Тарифы — Супер Математика',
    description: 'Выберите подходящий тариф тренажёра ментальной арифметики. Доступ к тренажёрам и абакусу.',
  });
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>Тарифы</Typography>
        <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 3 }}>
          Выберите подходящий период подписки. Полные условия оплаты и возврата доступны в пользовательском соглашении.
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table aria-label="Тарифы подписки">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Период подписки</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Стоимость подписки</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tariffRows.map((row) => (
                <TableRow key={row.period}>
                  <TableCell>{row.period}</TableCell>
                  <TableCell>{row.price}</TableCell>
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
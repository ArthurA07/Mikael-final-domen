import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Stack, Alert, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as any;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nextFieldErrors: { email?: string; password?: string } = {};
    const emailRegex = /^\S+@\S+\.[\S]+$/;
    if (!emailRegex.test(email)) {
      nextFieldErrors.email = 'Email в формате name@example.com';
    }
    if (password.length < 6) {
      nextFieldErrors.password = 'Пароль минимум 6 символов';
    }
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;
    try {
      const ok = await login(email, password);
      if (ok) {
        const to = location.state?.from?.pathname || '/dashboard';
        navigate(to, { replace: true });
      } else {
        setError('Неверный email или пароль');
      }
    } catch (e: any) {
      setError(e?.message || 'Неверный email или пароль');
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Войти</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField 
              label="Email" 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              helperText={fieldErrors.email || 'В формате name@example.com'}
              error={Boolean(fieldErrors.email)}
            />
            <TextField 
              label="Пароль" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              inputProps={{ minLength: 6 }}
              helperText={fieldErrors.password || 'Минимум 6 символов'}
              error={Boolean(fieldErrors.password)}
            />
            <Button type="submit" variant="contained" disabled={isLoading}>Войти</Button>
            <Link component={RouterLink} to="/forgot-password" underline="hover">Забыли пароль?</Link>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
};

export default LoginPage; 
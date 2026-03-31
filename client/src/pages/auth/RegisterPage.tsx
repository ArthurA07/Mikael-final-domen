import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Stack, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const RegisterPage: React.FC = () => {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Простая клиентская валидация до запроса
    const nextFieldErrors: { name?: string; email?: string; password?: string } = {};
    if (name.trim().length < 2 || name.trim().length > 50) {
      nextFieldErrors.name = 'Имя: от 2 до 50 символов';
    }
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
      const ok = await register({ name, email, password });
      if (ok) {
        navigate('/dashboard', { replace: true });
      } else {
        setError('Не удалось зарегистрироваться. Проверьте данные.');
      }
    } catch (e: any) {
      setError(e?.message || 'Не удалось зарегистрироваться');
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 480 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Регистрация</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField 
              label="Имя"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              inputProps={{ minLength: 2, maxLength: 50 }}
              helperText={fieldErrors.name || 'От 2 до 50 символов'}
              error={Boolean(fieldErrors.name)}
            />
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
            <Button type="submit" variant="contained" disabled={isLoading}>Создать аккаунт</Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
};

export default RegisterPage;

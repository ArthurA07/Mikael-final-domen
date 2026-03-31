import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert } from '@mui/material';
import axios from 'axios';

const ResetPassword: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password2, setPassword2] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!password || password.length < 6) {
      setError('Минимум 6 символов.');
      return;
    }
    if (password !== password2) {
      setError('Пароли не совпадают.');
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post('/auth/reset-password', { token, password });
      if (res.data?.success) {
        setSuccess('Пароль обновлён. Теперь вы можете войти.');
      } else {
        setError('Не удалось обновить пароль.');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Не удалось обновить пароль.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 480 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Новый пароль</Typography>
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={onSubmit}>
          <TextField
            label="Новый пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          <TextField
            label="Повторите пароль"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          <Button type="submit" variant="contained" disabled={loading || !token}>
            Сохранить пароль
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default ResetPassword;



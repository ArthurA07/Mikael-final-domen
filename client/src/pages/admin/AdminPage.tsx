import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, IconButton, InputAdornment, Pagination, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, Dialog, DialogTitle, DialogContent, DialogActions, useMediaQuery } from '@mui/material';
import { Search, FileDownload, Refresh } from '@mui/icons-material';
import axios from 'axios';
import dayjs from 'dayjs';

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const AdminPage: React.FC = () => {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPassword2, setResetPassword2] = useState('');
  const [resetError, setResetError] = useState('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const isMobile = useMediaQuery('(max-width:900px)');

  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const res = await axios.get('/admin/users', { params: { q, page, limit } });
      const data = res.data?.data;
      setUsers(data?.items || []);
      setTotalPages(data?.pagination?.total || 1);
    } finally {
      setLoading(false);
    }
  }, [q, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Получаем мой профиль, чтобы показать текущий email админа
    (async () => {
      try {
        const res = await axios.get('/auth/me');
        const email = res.data?.data?.user?.email || '';
        setAdminEmail(email);
      } catch {}
    })();
  }, []);

  const handleExport = async (userId: string) => {
    // Запрашиваем CSV с авторизацией и скачиваем как файл
    const params: any = {};
    if (from) params.from = from;
    if (to) params.to = to ? dayjs(to).endOf('day').toISOString() : undefined;
    const res = await axios.get(`/admin/users/${userId}/export`, { responseType: 'blob', params });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const periodSuffix = from || to ? `_${from || '...'}_${to || '...'}` : '';
    link.setAttribute('download', `history${periodSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const openResetPassword = (userId: string) => {
    setResetUserId(userId);
    setResetPassword('');
    setResetPassword2('');
    setResetError('');
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    let out = '';
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setResetPassword(out);
    setResetPassword2(out);
  };

  const handleResetSubmit = async () => {
    if (!resetPassword || resetPassword.length < 8) {
      setResetError('Минимум 8 символов');
      return;
    }
    if (resetPassword !== resetPassword2) {
      setResetError('Пароли не совпадают');
      return;
    }
    try {
      await axios.post(`/admin/users/${resetUserId}/reset-password`, { newPassword: resetPassword });
      alert('Пароль обновлён');
      setResetUserId(null);
    } catch (e: any) {
      setResetError(e?.response?.data?.error?.message || 'Ошибка сброса пароля');
    }
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: 2 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>Админ-панель</Typography>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>Смена email администратора</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label="Текущий email" value={adminEmail} size="small" InputProps={{ readOnly: true }} />
            <TextField label="Новый email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} size="small" />
            <Button variant="contained" onClick={async () => {
              setEmailMsg(null);
              try {
                const res = await axios.post('/admin/change-email', { newEmail });
                setAdminEmail(res.data?.data?.newEmail || newEmail);
                setNewEmail('');
                setEmailMsg('Email обновлён');
              } catch (e: any) {
                setEmailMsg(e?.response?.data?.error?.message || 'Ошибка смены email');
              }
            }}>Сохранить</Button>
            {emailMsg && <Typography variant="body2" color="text.secondary">{emailMsg}</Typography>}
          </Box>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              placeholder="Поиск по email или имени"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              size="small"
            />
            <TextField
              label="С"
              type="date"
              size="small"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="По"
              type="date"
              size="small"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="contained" onClick={() => { setPage(1); load(); }}>Искать</Button>
            <IconButton onClick={() => { setQ(''); setPage(1); load(); }}><Refresh /></IconButton>
            <Chip label={`Стр. ${page} / ${totalPages}`} color="primary" />
            <Button
              variant="outlined"
              onClick={async () => {
                const params: any = {};
                if (from) params.from = from;
                if (to) params.to = dayjs(to).endOf('day').toISOString();
                const res = await axios.get('/admin/export', { responseType: 'blob', params });
                const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const suffix = from || to ? `_${from || '...'}_${to || '...'}` : '';
                link.setAttribute('download', `all-history${suffix}.csv`);
                document.body.appendChild(link);
                link.click();
                link.parentNode?.removeChild(link);
                window.URL.revokeObjectURL(url);
              }}
            >
              Экспорт всех
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          {!isMobile ? (
            <>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Имя</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Роль</TableCell>
                    <TableCell>Создан</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u._id} hover>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.role}</TableCell>
                      <TableCell>{dayjs(u.createdAt).format('YYYY-MM-DD HH:mm')}</TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" startIcon={<FileDownload />} onClick={() => handleExport(u._id)}>Экспорт</Button>
                        <Button size="small" sx={{ ml: 1 }} variant="contained" color="warning" onClick={() => openResetPassword(u._id)}>Сброс пароля</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            <Box sx={{ display: 'grid', gap: 1 }}>
              {users.map((u) => (
                <Card key={u._id} variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{u.name}</Typography>
                    <Typography variant="body2">{u.email}</Typography>
                    <Chip label={u.role} size="small" sx={{ mt: 1 }} />
                    <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>Создан: {dayjs(u.createdAt).format('YYYY-MM-DD HH:mm')}</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Button size="small" variant="outlined" startIcon={<FileDownload />} onClick={() => handleExport(u._id)}>Экспорт</Button>
                      <Button size="small" variant="contained" color="warning" onClick={() => openResetPassword(u._id)}>Сброс</Button>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} />
          </Box>
          {loading && <Typography sx={{ mt: 1 }}>Загрузка...</Typography>}
        </CardContent>
      </Card>

      <Dialog open={!!resetUserId} onClose={() => setResetUserId(null)}>
        <DialogTitle>Сброс пароля</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            fullWidth
            type="password"
            label="Новый пароль (мин. 8 символов)"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
          />
          <TextField
            margin="dense"
            fullWidth
            type="password"
            label="Повторите пароль"
            value={resetPassword2}
            onChange={(e) => setResetPassword2(e.target.value)}
          />
          {!!resetError && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>{resetError}</Typography>
          )}
          <Button onClick={generatePassword} sx={{ mt: 1 }}>
            Сгенерировать безопасный пароль
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetUserId(null)}>Отмена</Button>
          <Button variant="contained" onClick={handleResetSubmit}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPage;



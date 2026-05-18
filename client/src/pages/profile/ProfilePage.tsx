import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, TextField, Button, Stack, Alert, Avatar, Collapse, Chip, Tabs, Tab } from '@mui/material';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

type SubscriptionStatus = 'demo' | 'active' | 'expired' | 'canceled';

interface SubscriptionInfo {
  status?: SubscriptionStatus;
  planMonths?: number | null;
  paidUntil?: string | null;
  lastPaymentAt?: string | null;
}

const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Статичный аватар со счётами (inline SVG)
  const DEFAULT_AVATAR =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <defs>
          <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#ffd5dc"/>
            <stop offset="100%" stop-color="#d1d4f9"/>
          </linearGradient>
        </defs>
        <rect width="128" height="128" rx="16" fill="url(#bg)"/>
        <rect x="20" y="16" width="88" height="96" rx="8" fill="#8B5E3C"/>
        <rect x="26" y="24" width="76" height="80" rx="4" fill="#C08A5C"/>
        <!-- перекладины -->
        <g stroke="#6D3F24" stroke-width="4">
          <line x1="34" y1="40" x2="94" y2="40"/>
          <line x1="34" y1="60" x2="94" y2="60"/>
          <line x1="34" y1="80" x2="94" y2="80"/>
        </g>
        <!-- косточки -->
        <g>
          <circle cx="46" cy="40" r="7" fill="#FF7F50"/>
          <circle cx="66" cy="40" r="7" fill="#FF7F50"/>
          <circle cx="86" cy="40" r="7" fill="#FF7F50"/>
          <circle cx="46" cy="60" r="7" fill="#4ECDC4"/>
          <circle cx="66" cy="60" r="7" fill="#4ECDC4"/>
          <circle cx="86" cy="60" r="7" fill="#4ECDC4"/>
          <circle cx="46" cy="80" r="7" fill="#FFD93D"/>
          <circle cx="66" cy="80" r="7" fill="#FFD93D"/>
          <circle cx="86" cy="80" r="7" fill="#FFD93D"/>
        </g>
      </svg>
    `);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setEmail(user.email || '');
      // аватар теперь статичный для всех
    }
  }, [user]);

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        setSubscriptionLoading(true);
        const response = await axios.get('/payments/subscription');
        setSubscription(response?.data?.data?.subscription || null);
      } catch {
        setSubscription(null);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    loadSubscription();
  }, []);

  const subscriptionInfo = useMemo(() => {
    const status = subscription?.status || 'demo';
    const paidUntil = subscription?.paidUntil ? new Date(subscription.paidUntil) : null;
    const isActive = status === 'active' && !!paidUntil && paidUntil.getTime() > Date.now();

    if (isActive) {
      return {
        severity: 'success' as const,
        title: 'Подписка активна',
        text: `Подписка действует до ${paidUntil.toLocaleDateString('ru-RU')}.`,
      };
    }
    if (status === 'expired') {
      return {
        severity: 'warning' as const,
        title: 'Подписка истекла',
        text: 'Чтобы продолжить обучение, выберите тариф для продления доступа.',
      };
    }
    if (status === 'canceled') {
      return {
        severity: 'warning' as const,
        title: 'Платеж отменен',
        text: 'Повторите оплату, чтобы активировать доступ.',
      };
    }
    return {
      severity: 'info' as const,
      title: 'Пробный статус',
      text: 'Активируйте подписку, чтобы открыть полный доступ ко всем разделам.',
    };
  }, [subscription]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      setSaving(true);
      const payload: any = {};
      if (name.trim()) payload.name = name.trim();
      if (phone.trim()) payload.phone = phone.trim();
      // аватар не редактируется — статичный
      const res = await axios.put('/auth/profile', payload);
      if (res.data?.success) {
        updateUser(res.data.data.user);
        setSuccess('Профиль обновлён');
      } else {
        setError('Не удалось сохранить профиль');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdErr(null);
    setPwdMsg(null);
    if (newPassword.length < 6) {
      setPwdErr('Новый пароль минимум 6 символов');
      return;
    }
    try {
      await axios.put('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPwdMsg('Пароль обновлён');
      setCurrentPassword('');
      setNewPassword('');
    } catch (e: any) {
      setPwdErr(e?.response?.data?.error?.message || 'Не удалось изменить пароль');
    }
  };

  return (
    <Box p={3}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={DEFAULT_AVATAR} sx={{ width: 72, height: 72 }} />
            <Box>
              <Typography variant="h4">Профиль пользователя</Typography>
              <Typography color="text.secondary">{user?.email}</Typography>
            </Box>
          </Stack>
          {!subscriptionLoading && (
            <Chip
              label={subscriptionInfo.title}
              color={subscriptionInfo.severity === 'success' ? 'success' : 'warning'}
              sx={{ fontWeight: 700 }}
            />
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto">
          <Tab label="Личные данные" />
          <Tab label="Подписка" />
          <Tab label="Безопасность" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <Paper sx={{ p: 3, maxWidth: 720 }}>
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <form onSubmit={onSave}>
            <Stack spacing={2}>
              <TextField label="Email" value={email} InputProps={{ readOnly: true }} />
              <TextField
                label="Имя"
                value={name}
                onChange={e => setName(e.target.value)}
                inputProps={{ minLength: 2, maxLength: 50 }}
                helperText="От 2 до 50 символов"
                required
              />
              <TextField
                label="Телефон"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+7 999 123-45-67"
                helperText="Формат: +7 999 123-45-67"
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button type="submit" variant="contained" disabled={saving}>
                  Сохранить изменения
                </Button>
                <Button variant="outlined" onClick={() => navigate('/dashboard')}>
                  В личный кабинет
                </Button>
              </Stack>
            </Stack>
          </form>
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper sx={{ p: 3, maxWidth: 720 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Подписка и доступ</Typography>
          <Alert severity={subscriptionInfo.severity} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{subscriptionInfo.title}</Typography>
            <Typography variant="body2">{subscriptionInfo.text}</Typography>
          </Alert>
          {subscription?.paidUntil && (
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              Оплачено до: {new Date(subscription.paidUntil).toLocaleDateString('ru-RU')}
            </Typography>
          )}
          {subscription?.lastPaymentAt && (
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Последний платеж: {new Date(subscription.lastPaymentAt).toLocaleString('ru-RU')}
            </Typography>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button variant="contained" onClick={() => navigate('/pricing')}>
              {subscription?.status === 'active' ? 'Продлить подписку' : 'Выбрать тариф'}
            </Button>
            <Button variant="outlined" onClick={() => navigate('/trainer')}>
              Перейти к тренировкам
            </Button>
          </Stack>
        </Paper>
      )}

      {activeTab === 2 && (
        <Paper sx={{ p: 3, maxWidth: 720 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Безопасность</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Регулярно обновляйте пароль для защиты аккаунта.
          </Typography>
          <Button variant="outlined" size="small" sx={{ mb: 2 }} onClick={() => setPwdOpen(v => !v)}>
            {pwdOpen ? 'Скрыть форму' : 'Изменить пароль'}
          </Button>
          <Collapse in={pwdOpen}>
            {pwdMsg && <Alert severity="success" sx={{ mb: 2 }}>{pwdMsg}</Alert>}
            {pwdErr && <Alert severity="error" sx={{ mb: 2 }}>{pwdErr}</Alert>}
            <form onSubmit={onChangePassword}>
              <Stack spacing={2}>
                <TextField
                  label="Текущий пароль"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                />
                <TextField
                  label="Новый пароль"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  inputProps={{ minLength: 6 }}
                  helperText="Минимум 6 символов"
                />
                <Button type="submit" variant="contained">Обновить пароль</Button>
              </Stack>
            </form>
          </Collapse>
        </Paper>
      )}
    </Box>
  );
};

export default ProfilePage;

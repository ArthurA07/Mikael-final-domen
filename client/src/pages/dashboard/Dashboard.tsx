import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';

type SubscriptionStatus = 'demo' | 'active' | 'expired' | 'canceled';

interface SubscriptionInfo {
  status?: SubscriptionStatus;
  planMonths?: number | null;
  paidUntil?: string | null;
  lastPaymentAt?: string | null;
}

const tariffs = [
  { period: '1 месяц', price: '1 рубль (тест)' },
  { period: '3 месяца', price: '999 рублей' },
  { period: '6 месяцев', price: '1799 рублей' },
  { period: '12 месяцев', price: '2999 рублей' },
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userStats, achievements, refreshUserStats, refreshAchievements } = useUser();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [subscriptionResponse] = await Promise.all([
          axios.get('/payments/subscription'),
          refreshUserStats(),
          refreshAchievements(),
        ]);
        setSubscription(subscriptionResponse?.data?.data?.subscription || null);
      } catch {
        setSubscription(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscriptionView = useMemo(() => {
    const status = subscription?.status || 'demo';
    const paidUntil = subscription?.paidUntil ? new Date(subscription.paidUntil) : null;
    const isActive = status === 'active' && !!paidUntil && paidUntil.getTime() > Date.now();
    const statusLabel = isActive
      ? 'Подписка активна'
      : (status === 'demo' ? 'Демо-доступ активен' : 'Подписка не активна');

    if (isActive) {
      return {
        severity: 'success' as const,
        title: 'Подписка активна',
        text: `Доступ открыт до ${paidUntil.toLocaleDateString('ru-RU')}.`,
        statusLabel,
      };
    }

    if (status === 'expired') {
      return {
        severity: 'warning' as const,
        title: 'Подписка истекла',
        text: 'Чтобы продолжить обучение без ограничений, выберите удобный тариф и оплатите подписку.',
        statusLabel,
      };
    }

    if (status === 'canceled') {
      return {
        severity: 'warning' as const,
        title: 'Платеж был отменен',
        text: 'Выберите тариф и повторите оплату. Доступ активируется автоматически после успешного платежа.',
        statusLabel,
      };
    }

    return {
      severity: 'info' as const,
      title: 'Пробный статус',
      text: 'Вы зарегистрированы, но подписка еще не активирована. Выберите тариф и начните полноценные тренировки.',
      statusLabel,
    };
  }, [subscription]);

  const statsView = useMemo(() => {
    const totalExercises = Number(userStats?.totalExercises || 0);
    const correctAnswers = Number(userStats?.correctAnswers || 0);
    const accuracy = totalExercises > 0 ? Math.round((correctAnswers / totalExercises) * 100) : 0;
    const xp = Number(userStats?.experiencePoints || 0);
    const xpInLevel = xp % 1000;
    const levelProgress = Math.min(100, Math.round((xpInLevel / 1000) * 100));

    return {
      totalExercises,
      correctAnswers,
      accuracy,
      level: Number(userStats?.level || 1),
      xpInLevel,
      levelProgress,
      streak: Number(userStats?.currentStreak || 0),
      achievementsCount: achievements.length,
    };
  }, [achievements.length, userStats]);

  if (loading) {
    return (
      <Box p={3} sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h4" sx={{ mb: 0.5 }}>
              Личный кабинет
            </Typography>
            <Typography color="text.secondary">
              {`Здравствуйте, ${user?.name || 'пользователь'}! Здесь все ключевое: доступ, прогресс и действия.`}
            </Typography>
          </Box>
          <Chip
            label={subscriptionView.statusLabel}
            color={subscriptionView.severity === 'success' ? 'success' : 'warning'}
            sx={{ fontWeight: 700 }}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <Button variant="contained" onClick={() => navigate('/pricing')}>
            Оплатить или продлить
          </Button>
          <Button variant="outlined" onClick={() => navigate('/trainer')}>
            Начать тренировку
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Обзор" />
          <Tab label="Подписка" />
          <Tab label="Прогресс" />
          <Tab label="Быстрые действия" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <Stack spacing={2}>
          <Paper sx={{ p: 3 }}>
            <Alert severity={subscriptionView.severity} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {subscriptionView.title}
              </Typography>
              <Typography variant="body2">{subscriptionView.text}</Typography>
            </Alert>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                gap: 2,
              }}
            >
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography color="text.secondary">Упражнений</Typography>
                <Typography variant="h5">{statsView.totalExercises}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography color="text.secondary">Точность</Typography>
                <Typography variant="h5">{statsView.accuracy}%</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography color="text.secondary">Текущий уровень</Typography>
                <Typography variant="h5">{statsView.level}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography color="text.secondary">Достижений</Typography>
                <Typography variant="h5">{statsView.achievementsCount}</Typography>
              </Paper>
            </Box>
          </Paper>
        </Stack>
      )}

      {activeTab === 1 && (
        <Stack spacing={2}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Управление подпиской
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Оплата проходит через ЮKassa, статус обновляется автоматически после подтверждения платежа.
            </Typography>
            <Alert severity={subscriptionView.severity} sx={{ mb: 2 }}>
              {subscriptionView.text}
            </Alert>
            {subscription?.paidUntil && (
              <Typography color="text.secondary" sx={{ mb: 1 }}>
                Оплачено до: {new Date(subscription.paidUntil).toLocaleDateString('ru-RU')}
              </Typography>
            )}
            {subscription?.lastPaymentAt && (
              <Typography color="text.secondary">
                Последний платеж: {new Date(subscription.lastPaymentAt).toLocaleString('ru-RU')}
              </Typography>
            )}
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              {tariffs.map((tariff) => (
                <Paper key={tariff.period} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography>{tariff.period}</Typography>
                    <Typography sx={{ fontWeight: 700 }}>{tariff.price}</Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
            <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/pricing')}>
              Перейти к оплате
            </Button>
          </Paper>
        </Stack>
      )}

      {activeTab === 2 && (
        <Stack spacing={2}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Прогресс обучения
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Следите за динамикой и возвращайтесь к тренировкам с удобных точек входа.
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 2,
              }}
            >
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography color="text.secondary">Правильных ответов</Typography>
                <Typography variant="h5">{statsView.correctAnswers}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography color="text.secondary">Серия ответов</Typography>
                <Typography variant="h5">{statsView.streak}</Typography>
              </Paper>
            </Box>
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Прогресс уровня: {statsView.xpInLevel} / 1000 XP
              </Typography>
              <LinearProgress variant="determinate" value={statsView.levelProgress} />
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
              <Button variant="outlined" onClick={() => navigate('/stats')}>
                Открыть статистику
              </Button>
              <Button variant="outlined" onClick={() => navigate('/stats/history')}>
                История тренировок
              </Button>
            </Stack>
          </Paper>
        </Stack>
      )}

      {activeTab === 3 && (
        <Stack spacing={2}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Быстрые действия
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 2,
              }}
            >
              <Button variant="contained" onClick={() => navigate('/trainer')}>
                Начать тренировку
              </Button>
              <Button variant="outlined" onClick={() => navigate('/abacus')}>
                Открыть абакус
              </Button>
              <Button variant="outlined" onClick={() => navigate('/pricing')}>
                Тарифы и оплата
              </Button>
              <Button variant="outlined" onClick={() => navigate('/profile')}>
                Настройки профиля
              </Button>
            </Box>
          </Paper>
        </Stack>
      )}
    </Box>
  );
};

export default Dashboard;

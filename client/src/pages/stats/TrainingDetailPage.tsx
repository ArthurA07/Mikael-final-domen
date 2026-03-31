import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, Stack, Chip } from '@mui/material';
import axios from 'axios';

const TrainingDetailPage: React.FC = () => {
  const id = window.location.pathname.split('/').pop();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`/user/training/${id}`);
        setData(res.data?.data?.training);
      } catch (e: any) {
        setError(e?.response?.data?.error?.message || 'Не удалось загрузить тренировку');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <Box p={3}><CircularProgress /></Box>;
  if (error) return <Box p={3}><Alert severity="error">{error}</Alert></Box>;
  if (!data) return null;

  const total = data.results?.totalProblems || 0;
  const correct = data.results?.correctAnswers || 0;

  const renderExpr = (p: any) => {
    const nums: any[] = Array.isArray(p?.numbers) ? p.numbers : [];
    if (!nums.length) return '';
    const ops: any[] | undefined = Array.isArray(p?.ops) ? p.ops : undefined;
    // Если есть ops (последовательность), используем её; иначе fallback на один operation
    let s = String(nums[0]);
    for (let i = 1; i < nums.length; i++) {
      const op = ops?.[i - 1] || p.operation || '+';
      s += ` ${op} ${nums[i]}`;
    }
    return s;
  };

  return (
    <Box p={3}>
      <Typography variant="h4" sx={{ mb: 2 }}>Тренировка от {new Date(data.createdAt).toLocaleString()}</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Chip label={data.settings?.displayMode === 'abacus' ? 'Абакус' : 'Цифры'} />
          <Chip label={`Операции: ${data.settings?.operations?.join(', ')}`} />
          <Chip label={`Чисел: ${data.settings?.numbersCount}`} />
          <Chip label={`Диапазон: 1–${data.settings?.numberRange}`} />
          <Chip label={`Точность: ${data.results?.accuracy ?? 0}%`} />
        </Stack>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Примеры</Typography>
        {data.problems?.length ? data.problems.map((p: any, i: number) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 1, borderBottom: '1px solid #eee', flexDirection: { xs: 'column', md: 'row' } }}>
            <Typography>{renderExpr(p)} = {p.correctAnswer}</Typography>
            <Typography color={p.isCorrect ? 'success.main' : 'error.main'}>
              Ваш ответ: {p.userAnswer ?? '—'} · {Math.round(p.timeSpent || 0)} мс
            </Typography>
          </Box>
        )) : <Typography color="text.secondary">Нет данных по примерам</Typography>}
      </Paper>
    </Box>
  );
};

export default TrainingDetailPage;



const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Training = require('../models/Training');
const { protect, authorize } = require('../middleware/auth');
const FreeAccess = require('../models/FreeAccess');

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(protect);

// Получение настроек тренажёра пользователя
router.get('/trainer-settings', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: {
        settings: user.trainerSettings
      }
    });
  } catch (error) {
    console.error('Get trainer settings error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при получении настроек тренажёра'
      }
    });
  }
});

// Обновление настроек тренажёра
router.put('/trainer-settings', [
  body('numbersCount')
    .optional()
    .isInt({ min: 1, max: 15 })
    .withMessage('Количество чисел должно быть от 1 до 15'),
  body('numberRange')
    .optional()
    .isIn([9, 99, 999, 999999, 1000000])
    .withMessage('Неверный диапазон чисел (используйте 9,99,999,999999,1000000)'),
  body('operations')
    .optional()
    .isArray()
    .withMessage('Операции должны быть массивом'),
  body('operations.*')
    .isIn(['+', '-', '*', '/'])
    .withMessage('Недопустимая операция'),
  body('displaySpeed')
    .optional()
    .isInt({ min: 100, max: 10000 })
    .withMessage('Скорость отображения должна быть от 100 до 10000 мс'),
  body('totalProblems')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Количество примеров должно быть от 1 до 100'),
  body('displayMode')
    .optional()
    .isIn(['digits', 'abacus'])
    .withMessage('Режим отображения должен быть digits или abacus'),
  body('soundEnabled')
    .optional()
    .isBoolean()
    .withMessage('soundEnabled должен быть булевым значением'),
  body('voiceInput')
    .optional()
    .isBoolean()
    .withMessage('voiceInput должен быть булевым значением'),
  body('showAnswer')
    .optional()
    .isBoolean()
    .withMessage('showAnswer должен быть булевым значением'),
  body('twoScreens')
    .optional()
    .isBoolean()
    .withMessage('twoScreens должен быть булевым значением'),
  body('lawsMode')
    .optional()
    .isIn(['none','five','ten','both'])
    .withMessage('Неверное значение lawsMode'),
  body('progressiveMode')
    .optional()
    .isBoolean()
    .withMessage('progressiveMode должен быть булевым значением'),
  body('randomPosition')
    .optional()
    .isBoolean()
    .withMessage('randomPosition должен быть булевым значением'),
  body('randomColor')
    .optional()
    .isBoolean()
    .withMessage('randomColor должен быть булевым значением'),
  body('randomFont')
    .optional()
    .isBoolean()
    .withMessage('randomFont должен быть булевым значением')
  ,
  // Новые поля
  // Ограничения по ТЗ: множители <= 3 разряда, делимое <= 6, делители <= 4
  body('multiplyDigits1').optional({ nullable: true }).custom(v => v === null || (Number.isInteger(v) && v >= 1 && v <= 3)),
  body('multiplyDigits2').optional({ nullable: true }).custom(v => v === null || (Number.isInteger(v) && v >= 1 && v <= 3)),
  body('multiplyDigits3').optional({ nullable: true }).custom(v => v === null || (Number.isInteger(v) && v >= 1 && v <= 3)),
  body('divisionDividendDigits').optional({ nullable: true }).custom(v => v === null || (Number.isInteger(v) && v >= 1 && v <= 6)),
  body('divisionDivisorDigits').optional({ nullable: true }).custom(v => v === null || (Number.isInteger(v) && v >= 1 && v <= 4)),
  body('divisionSecondDivisorDigits').optional({ nullable: true }).custom(v => v === null || (Number.isInteger(v) && v >= 1 && v <= 4)),
  body('preStartPause').optional().isInt({ min: 0, max: 60 }),
  body('answerPause').optional().isInt({ min: 0, max: 120 }),
  body('resultPause').optional().isInt({ min: 0, max: 60 }),
  body('fontScale').optional().isFloat({ min: 0.5, max: 3 }),
  body('randomPosition').optional().isBoolean(),
  body('randomColor').optional().isBoolean(),
  body('sequentialDisplay').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          message: 'Ошибки валидации',
          details: errors.array()
        }
      });
    }

    const updates = {};
    const unsets = {};
    Object.keys(req.body).forEach(key => {
      const val = req.body[key];
      if (val === null) {
        unsets[`trainerSettings.${key}`] = "";
      } else {
        updates[`trainerSettings.${key}`] = val;
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { ...(Object.keys(updates).length ? { $set: updates } : {}), ...(Object.keys(unsets).length ? { $unset: unsets } : {}) },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Настройки тренажёра обновлены',
      data: {
        settings: user.trainerSettings
      }
    });
  } catch (error) {
    console.error('Update trainer settings error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при обновлении настроек тренажёра'
      }
    });
  }
});

// Получение статистики пользователя
router.get('/stats', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    
    // Получаем общую статистику из Training
    let trainingStats;
    try {
      trainingStats = await Training.getUserStats(req.user._id, period);
    } catch (e) {
      // Безопасный фолбэк — не ломаем страницу, даже если агрегация упала
      trainingStats = {
        totalSessions: 0,
        totalProblems: 0,
        totalCorrect: 0,
        totalTime: 0,
        averageAccuracy: 0,
        bestAccuracy: 0,
        totalScore: 0,
        bestScore: 0
      };
    }
    
    // Получаем статистику из профиля пользователя
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: { message: 'Пользователь не найден' } });
    // Последняя сессия
    const lastSession = await Training.getLastSession(req.user._id);
    
    res.json({
      success: true,
      data: {
        profile: user.stats || { totalExercises:0, correctAnswers:0, totalTime:0, bestAccuracy:0, level:1 },
        training: trainingStats,
        achievements: user.achievements,
        lastSession
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при получении статистики',
        details: error?.message || String(error)
      }
    });
  }
});

// Получение прогресса пользователя за период
router.get('/progress', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const progress = await Training.getUserProgress(req.user._id, parseInt(days));
    
    res.json({
      success: true,
      data: {
        progress
      }
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при получении прогресса'
      }
    });
  }
});

// Получение истории тренировок
router.get('/training-history', async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', mode, from, to } = req.query;
    
    const options = {
      skip: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };
    
    const filter = { userId: req.user._id, completed: true };
    if (mode === 'digits' || mode === 'abacus') {
      filter['settings.displayMode'] = mode;
    }
    if (from || to) {
      filter['createdAt'] = {};
      if (from) filter['createdAt'].$gte = new Date(from);
      if (to) filter['createdAt'].$lte = new Date(to);
    }
    const trainings = await Training.find(filter, null, options);
    
    const total = await Training.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        trainings,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: trainings.length,
          totalRecords: total
        }
      }
    });
  } catch (error) {
    console.error('Get training history error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при получении истории тренировок'
      }
    });
  }
});

// Получение одной тренировки по id (для детального просмотра)
router.get('/training/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const training = await Training.findOne({ _id: id, userId: req.user._id });
    if (!training) {
      return res.status(404).json({ error: { message: 'Тренировка не найдена' } });
    }
    res.json({ success: true, data: { training } });
  } catch (error) {
    console.error('Get training detail error:', error);
    res.status(500).json({ error: { message: 'Ошибка при получении тренировки' } });
  }
});

// Добавление достижения
router.post('/achievements', [
  body('id')
    .notEmpty()
    .withMessage('ID достижения обязателен'),
  body('name')
    .notEmpty()
    .withMessage('Название достижения обязательно'),
  body('description')
    .notEmpty()
    .withMessage('Описание достижения обязательно'),
  body('icon')
    .optional()
    .isString()
    .withMessage('Иконка должна быть строкой')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    // Вместо жёсткого отказа — мягко логируем и продолжаем, если пришли лишние поля
    if (!errors.isEmpty()) {
      console.warn('Achievements validation warnings:', errors.array());
    }

    const { id, name, description, icon } = req.body || {};
    if (!id || !name || !description) {
      return res.status(400).json({ error: { message: 'Некорректные данные достижения' } });
    }
    
    const user = await User.findById(req.user._id);
    
    // Проверяем, не получено ли уже это достижение
    const existingAchievement = user.achievements.find(ach => ach.id === id);
    if (existingAchievement) {
      return res.status(400).json({
        error: {
          message: 'Достижение уже получено'
        }
      });
    }
    
    // Добавляем достижение
    user.achievements.push({
      id,
      name,
      description,
      icon: icon || 'trophy',
      unlockedAt: new Date()
    });
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Достижение добавлено',
      data: {
        achievement: user.achievements[user.achievements.length - 1]
      }
    });
  } catch (error) {
    console.error('Add achievement error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при добавлении достижения'
      }
    });
  }
});

// Обновление статистики пользователя
router.put('/stats', [
  body('totalExercises')
    .optional()
    .isInt({ min: 0 })
    .withMessage('totalExercises должен быть неотрицательным числом'),
  body('correctAnswers')
    .optional()
    .isInt({ min: 0 })
    .withMessage('correctAnswers должен быть неотрицательным числом'),
  body('totalTime')
    .optional()
    .isInt({ min: 0 })
    .withMessage('totalTime должен быть неотрицательным числом'),
  body('currentStreak')
    .optional()
    .isInt({ min: 0 })
    .withMessage('currentStreak должен быть неотрицательным числом'),
  body('experiencePoints')
    .optional()
    .isInt({ min: 0 })
    .withMessage('experiencePoints должен быть неотрицательным числом')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          message: 'Ошибки валидации',
          details: errors.array()
        }
      });
    }

    const setUpdates = {};
    const incUpdates = {};
    // Поддержка атомарных инкрементов, чтобы не терять значения из-за гонок
    if (req.body.incTotalExercises) incUpdates['stats.totalExercises'] = parseInt(req.body.incTotalExercises, 10);
    if (req.body.incCorrectAnswers) incUpdates['stats.correctAnswers'] = parseInt(req.body.incCorrectAnswers, 10);
    if (req.body.incTotalTime) incUpdates['stats.totalTime'] = parseInt(req.body.incTotalTime, 10);
    
    // Прямая установка значений (если пришли абсолютные)
    ['totalExercises','correctAnswers','totalTime','currentStreak','experiencePoints','bestAccuracy','longestStreak','level'].forEach(k => {
      if (req.body[k] !== undefined) setUpdates[`stats.${k}`] = req.body[k];
    });

    // Вычисляем уровень на основе опыта
    if (req.body.experiencePoints !== undefined) {
      const level = Math.floor(req.body.experiencePoints / 1000) + 1;
      setUpdates['stats.level'] = level;
    }

    // Обновляем лучшую точность
    // либо из абсолютных значений, либо из переданной accuracy
    if (req.body.accuracy !== undefined) {
      const accuracy = Math.round(req.body.accuracy);
      if (accuracy > (req.user.stats.bestAccuracy || 0)) {
        setUpdates['stats.bestAccuracy'] = accuracy;
      }
    } else if (req.body.correctAnswers !== undefined && req.body.totalExercises !== undefined) {
      const accuracy = Math.round((req.body.correctAnswers / req.body.totalExercises) * 100);
      if (accuracy > (req.user.stats.bestAccuracy || 0)) {
        setUpdates['stats.bestAccuracy'] = accuracy;
      }
    }

    // Обновляем самую длинную серию
    if (req.body.currentStreak !== undefined && req.body.currentStreak > req.user.stats.longestStreak) {
      setUpdates['stats.longestStreak'] = req.body.currentStreak;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { ...(Object.keys(setUpdates).length ? { $set: setUpdates } : {}), ...(Object.keys(incUpdates).length ? { $inc: incUpdates } : {}) },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Статистика обновлена',
      data: {
        stats: user.stats
      }
    });
  } catch (error) {
    console.error('Update stats error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при обновлении статистики'
      }
    });
  }
});

// Сброс статистики пользователя (опционально с очисткой истории)
router.post('/stats/reset', async (req, res) => {
  try {
    const { deleteHistory = false } = req.body || {};

    // Сбрасываем агрегаты профиля
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { 'stats.totalExercises': 0, 'stats.correctAnswers': 0, 'stats.totalTime': 0, 'stats.bestAccuracy': 0, 'stats.currentStreak': 0, 'stats.longestStreak': 0, 'stats.level': 1, 'stats.experiencePoints': 0 } },
      { new: true }
    );

    // По запросу чистим историю тренировок
    if (deleteHistory) {
      await Training.deleteMany({ userId: req.user._id });
    }

    res.json({ success: true, message: 'Статистика сброшена', data: { stats: user.stats } });
  } catch (error) {
    console.error('Reset stats error:', error);
    res.status(500).json({ error: { message: 'Ошибка при сбросе статистики' } });
  }
});

// Технический маршрут: определить IP клиента и статус в белом списке
router.get('/my-ip', async (req, res) => {
  const rawIp = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket?.remoteAddress || '').toString();
  const firstIp = rawIp.split(',')[0].trim();
  const ip = firstIp.replace('::ffff:', '');
  const whitelist = (process.env.FREE_ACCESS_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
  const whitelisted = ip && whitelist.includes(ip);
  res.json({ success: true, data: { ip, rawIp, whitelisted, whitelist } });
});

// Проверка/выдача доступа к абакусу
// Для АВТОРИЗОВАННЫХ пользователей доступ всегда разрешён (без ограничений времени/IP)
// Для гостей сохраняем прежнюю логику бесплатного окна по IP (20 минут, один раз)
router.post('/free-abacus', async (req, res) => {
  try {
    // Если пользователь аутентифицирован, сразу разрешаем доступ
    if (req.user && req.user._id) {
      return res.json({ success: true, data: { allowed: true, reason: 'authenticated' } });
    }
    const rawIp = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket?.remoteAddress || '').toString();
    const firstIp = rawIp.split(',')[0].trim();
    const ip = firstIp.replace('::ffff:', '');
    const whitelist = [...(process.env.FREE_ACCESS_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean), '217.15.57.145'];
    if (ip && whitelist.includes(ip)) {
      return res.json({ success: true, data: { allowed: true, reason: 'whitelist', ip } });
    }
    if (!ip) {
      return res.status(400).json({ success: false, error: { message: 'Не удалось определить IP' } });
    }

    const now = new Date();
    let record = await FreeAccess.findOne({ ip });

    // Если есть блокировка — доступ запрещен
    if (record && record.blocked) {
      return res.json({ success: true, data: { allowed: false, reason: 'blocked', ip } });
    }

    // Если записи нет — создаём 20 минут доступа
    if (!record) {
      const startedAt = now;
      const expiresAt = new Date(now.getTime() + 20 * 60 * 1000);
      record = await FreeAccess.create({ ip, startedAt, expiresAt });
      return res.json({ success: true, data: { allowed: true, expiresAt, ip } });
    }

    // Если доступ есть и не истёк — пускаем
    if (record.expiresAt > now) {
      return res.json({ success: true, data: { allowed: true, expiresAt: record.expiresAt, ip } });
    }

    // Если истёк — повторно бесплатно не разрешаем
    return res.json({ success: true, data: { allowed: false, reason: 'expired', ip } });
  } catch (error) {
    console.error('Free abacus access error:', error);
    res.status(500).json({ success: false, error: { message: 'Ошибка при проверке доступа' } });
  }
});

module.exports = router; 

// Экспорт истории в CSV (админ)
router.get('/export/history', protect, authorize('admin'), async (req, res) => {
  try {
    const { userId, from, to } = req.query;
    if (!userId) return res.status(400).json({ error: { message: 'userId обязателен' } });
    const q = { userId };
    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from);
      if (to) q.createdAt.$lte = new Date(to);
    }
    const rows = await Training.find(q).sort({ createdAt: 1 });
    const header = 'date,mode,operations,numbersCount,range,total,correct,accuracy,score\n';
    const body = rows.map(r => [
      new Date(r.createdAt).toISOString(),
      r.settings.displayMode,
      (r.settings.operations || []).join(''),
      r.settings.numbersCount,
      `1-${r.settings.numberRange}`,
      r.results.totalProblems,
      r.results.correctAnswers,
      r.results.accuracy,
      r.results.score
    ].join(',')).join('\n');
    const csv = header + body;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="history.csv"');
    res.status(200).send(csv);
  } catch (e) {
    console.error('Export history error:', e);
    res.status(500).json({ error: { message: 'Ошибка экспорта' } });
  }
});

// Экспорт истории текущего пользователя (для HistoryPage)
router.get('/export/my-history', async (req, res) => {
  try {
    const { from, to, mode } = req.query;
    const q = { userId: req.user._id, completed: true };
    if (mode === 'digits' || mode === 'abacus') q['settings.displayMode'] = mode;
    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from);
      if (to) q.createdAt.$lte = new Date(to);
    }
    const rows = await Training.find(q).sort({ createdAt: 1 });
    const header = 'date,mode,operations,numbersCount,range,total,correct,accuracy,score\n';
    const body = rows.map(r => [
      new Date(r.createdAt).toISOString(),
      r.settings.displayMode,
      (r.settings.operations || []).join(''),
      r.settings.numbersCount,
      `1-${r.settings.numberRange}`,
      r.results.totalProblems,
      r.results.correctAnswers,
      r.results.accuracy,
      r.results.score
    ].join(',')).join('\n');
    const csv = header + body;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="my-history.csv"');
    res.status(200).send(csv);
  } catch (e) {
    console.error('Export my history error:', e);
    res.status(500).json({ error: { message: 'Ошибка экспорта' } });
  }
});
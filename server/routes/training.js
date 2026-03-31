const express = require('express');
const { body, validationResult } = require('express-validator');
const Training = require('../models/Training');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(protect);

// Ограничения по ТЗ (должны совпадать с клиентским генератором)
const MAX_MUL_VALUE = 999; // 3 разряда
const MAX_DIVIDEND_VALUE = 999999; // 6 разрядов
const MAX_DIVISOR_VALUE = 9999; // 4 разряда

// Генерация случайного числа в диапазоне (1..range), без нулей
const generateRandomNumber = (range) => {
  if (range === 1) return Math.floor(Math.random() * 9) + 1; // 1-9
  const hi = Math.max(1, Math.floor(range));
  return Math.floor(Math.random() * hi) + 1;
};

const randomIntInclusive = (min, max) => {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
};

// Генерация примера (без нулей, с ограничениями для ×/÷)
const generateProblem = (settings) => {
  const { numbersCount, numberRange, operations } = settings;
  const operation = operations[Math.floor(Math.random() * operations.length)];
  const count = Math.max(2, Math.min(Number(numbersCount) || 2, (operation === '*' || operation === '/') ? 3 : 15));

  // Умножение: каждый множитель <= 999
  if (operation === '*') {
    const cappedMax = Math.min(Number(numberRange) || 9, MAX_MUL_VALUE);
    const nums = Array.from({ length: Math.min(count, 3) }, () => generateRandomNumber(cappedMax));
    const correctAnswer = nums.reduce((p, n) => p * n, 1);
    return { numbers: nums, operation, correctAnswer, difficulty: 3 };
  }

  // Деление: конструктивно, без делителя 1, делимое <= 999999, делители <= 9999
  if (operation === '/') {
    const divCount = Math.min(count, 3) - 1; // 1 или 2 делителя
    const maxDividend = Math.min(MAX_DIVIDEND_VALUE, Number(numberRange) || MAX_DIVIDEND_VALUE);
    const minDividend = 1;

    const attempts = 80;
    for (let a = 0; a < attempts; a++) {
      const d1 = randomIntInclusive(2, MAX_DIVISOR_VALUE);
      const d2 = divCount >= 2 ? randomIntInclusive(2, MAX_DIVISOR_VALUE) : 1;
      const base = d1 * d2;
      const qMax = Math.floor(maxDividend / base);
      const qMin = Math.max(2, Math.ceil(minDividend / base));
      if (qMax < qMin) continue;
      const q = randomIntInclusive(qMin, qMax);
      const dividend = base * q;
      if (dividend < 1 || dividend > maxDividend) continue;
      const nums = divCount >= 2 ? [dividend, d1, d2] : [dividend, d1];
      return { numbers: nums, operation, correctAnswer: q, difficulty: 4 };
    }
    // Фолбэк
    const d1 = 2;
    const q = Math.max(2, Math.floor(maxDividend / d1) || 2);
    return { numbers: [d1 * q, d1], operation, correctAnswer: q, difficulty: 4 };
  }

  // Остальные операции (±): обычный генератор, без нулей
  const numbers = Array.from({ length: count }, () => generateRandomNumber(numberRange));
  let correctAnswer = numbers[0];
  for (let i = 1; i < numbers.length; i++) {
    correctAnswer = operation === '+' ? (correctAnswer + numbers[i]) : (correctAnswer - numbers[i]);
  }
  return {
    numbers,
    operation,
    correctAnswer,
    difficulty: Math.ceil(Math.log10(Math.max(2, Number(numberRange) || 9))) + (count - 1) * 0.5
  };
};

// Создание новой тренировочной сессии
router.post('/start', async (req, res) => {
  try {
    const { settings, sessionType = 'practice' } = req.body;

    const training = new Training({
      userId: req.user._id,
      settings,
      sessionType,
      problems: [],
      results: {
        totalProblems: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        accuracy: 0,
        totalTime: 0,
        averageTime: 0,
        score: 0
      },
      completed: false
    });

    await training.save();

    res.status(201).json({
      success: true,
      message: 'Тренировочная сессия создана',
      data: {
        trainingId: training._id,
        settings: training.settings
      }
    });
  } catch (error) {
    console.error('Start training error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при создании тренировочной сессии'
      }
    });
  }
});

// Получение нового примера
router.get('/:trainingId/problem', async (req, res) => {
  try {
    const { trainingId } = req.params;
    
    const training = await Training.findOne({
      _id: trainingId,
      userId: req.user._id,
      completed: false
    });
    
    if (!training) {
      return res.status(404).json({
        error: {
          message: 'Тренировочная сессия не найдена или завершена'
        }
      });
    }

    const problem = generateProblem(training.settings);

    res.json({
      success: true,
      data: {
        problem: {
          numbers: problem.numbers,
          operation: problem.operation,
          difficulty: problem.difficulty
        }
      }
    });
  } catch (error) {
    console.error('Get problem error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при генерации примера'
      }
    });
  }
});

// Завершение сессии и сохранение результатов
router.post('/complete', [
  body('problems').isArray().withMessage('problems должен быть массивом'),
  body('settings').isObject().withMessage('settings обязателен'),
  body('metrics').isObject().withMessage('metrics обязателен'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Ошибки валидации', details: errors.array() } });
    }

    const { problems, settings, metrics, sessionType = 'practice' } = req.body;

    const training = new Training({
      userId: req.user._id,
      settings: {
        numbersCount: settings.numbersCount,
        numberRange: settings.numberRange,
        operations: settings.operations,
        displaySpeed: settings.displaySpeed,
        displayMode: settings.displayMode,
        progressiveMode: settings.progressiveMode || false,
      },
      problems: problems.map((p) => ({
        numbers: p.numbers,
        operation: p.operation,
        ops: Array.isArray(p.ops) ? p.ops : undefined,
        correctAnswer: p.correctAnswer,
        userAnswer: p.userAnswer ?? null,
        isCorrect: !!p.isCorrect,
        timeSpent: p.timeSpent || 0,
        difficulty: p.difficulty || 1,
      })),
      results: {
        totalProblems: 0, // вычислится в pre('save')
        correctAnswers: 0,
        incorrectAnswers: 0,
        accuracy: 0,
        totalTime: metrics.totalTime || 0,
        averageTime: 0,
        score: 0,
      },
      sessionType,
      completed: true,
      completedAt: new Date(),
    });

    await training.save();

    res.json({ success: true, data: { trainingId: training._id } });
  } catch (error) {
    console.error('Complete training error:', error);
    res.status(500).json({ error: { message: 'Ошибка при сохранении результатов' } });
  }
});

module.exports = router; 
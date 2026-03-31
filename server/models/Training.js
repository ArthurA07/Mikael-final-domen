const mongoose = require('mongoose');

// Безопасное приведение к ObjectId
function toObjectId(id) {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === 'string') return new mongoose.Types.ObjectId(id);
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return id;
  }
}

const trainingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Параметры тренировки
  settings: {
    numbersCount: {
      type: Number,
      required: true
    },
    numberRange: {
      type: Number,
      required: true
    },
    operations: [{
      type: String,
      enum: ['+', '-', '*', '/']
    }],
    displaySpeed: {
      type: Number,
      required: true
    },
    displayMode: {
      type: String,
      enum: ['digits', 'abacus'],
      required: true
    },
    progressiveMode: {
      type: Boolean,
      default: false
    }
  },
  // Результаты тренировки
  results: {
    totalProblems: {
      type: Number,
      required: true,
      min: 0
    },
    correctAnswers: {
      type: Number,
      required: true,
      min: 0
    },
    incorrectAnswers: {
      type: Number,
      required: true,
      min: 0
    },
    accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    totalTime: {
      type: Number,
      required: true, // общее время в миллисекундах
      min: 0
    },
    averageTime: {
      type: Number,
      required: true, // среднее время на пример в миллисекундах
      min: 0
    },
    score: {
      type: Number,
      default: 0 // очки за тренировку
    }
  },
  // Детальная информация о каждом примере
  problems: [{
    numbers: [Number], // числа в примере
    operation: {
      type: String,
      enum: ['+', '-', '*', '/']
    },
    // Последовательность операций между числами (для смешанных выражений, например + и -)
    ops: [{
      type: String,
      enum: ['+', '-', '*', '/'],
    }],
    correctAnswer: Number,
    userAnswer: {
      type: Number,
      default: null
    },
    isCorrect: Boolean,
    timeSpent: Number, // время в миллисекундах
    difficulty: {
      type: Number,
      default: 1 // уровень сложности примера
    }
  }],
  // Метаданные
  sessionType: {
    type: String,
    enum: ['practice', 'test', 'challenge'],
    default: 'practice'
  },
  completed: {
    type: Boolean,
    default: false
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Индексы для быстрого поиска
trainingSchema.index({ userId: 1, createdAt: -1 });
trainingSchema.index({ userId: 1, 'results.accuracy': -1 });
trainingSchema.index({ userId: 1, 'results.score': -1 });

// Вычисление статистики перед сохранением
trainingSchema.pre('save', function(next) {
  if (this.problems && this.problems.length > 0) {
    const totalProblems = this.problems.length;
    const correctAnswers = this.problems.filter(p => p.isCorrect).length;
    const incorrectAnswers = totalProblems - correctAnswers;
    const accuracy = totalProblems > 0 ? Math.round((correctAnswers / totalProblems) * 100) : 0;
    
    // Общее время - сумма времени всех примеров
    const totalTime = this.problems.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
    const averageTime = totalProblems > 0 ? Math.round(totalTime / totalProblems) : 0;
    
    // Вычисление очков на основе точности, скорости и сложности
    const baseScore = correctAnswers * 10;
    const speedBonus = Math.max(0, 100 - Math.floor(averageTime / 100)); // бонус за скорость
    const accuracyBonus = Math.floor(accuracy * 2); // бонус за точность
    const score = baseScore + speedBonus + accuracyBonus;
    
    this.results = {
      totalProblems,
      correctAnswers,
      incorrectAnswers,
      accuracy,
      totalTime,
      averageTime,
      score
    };
  }
  
  if (this.completed && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Статические методы для получения статистики пользователя
trainingSchema.statics.getUserStats = async function(userId, period = 'all') {
  const matchStage = { userId: toObjectId(userId), completed: true };
  
  // Добавляем фильтр по времени если нужно
  if (period !== 'all') {
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = null;
    }
    
    if (startDate) {
      matchStage.createdAt = { $gte: startDate };
    }
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalProblems: { $sum: '$results.totalProblems' },
        totalCorrect: { $sum: '$results.correctAnswers' },
        totalTime: { $sum: '$results.totalTime' },
        averageAccuracy: { $avg: '$results.accuracy' },
        bestAccuracy: { $max: '$results.accuracy' },
        totalScore: { $sum: '$results.score' },
        bestScore: { $max: '$results.score' }
      }
    }
  ]);
  
  return stats[0] || {
    totalSessions: 0,
    totalProblems: 0,
    totalCorrect: 0,
    totalTime: 0,
    averageAccuracy: 0,
    bestAccuracy: 0,
    totalScore: 0,
    bestScore: 0
  };
};

// Получение прогресса пользователя за период
trainingSchema.statics.getUserProgress = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return await this.aggregate([
    {
      $match: {
        userId: toObjectId(userId),
        completed: true,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        sessions: { $sum: 1 },
        accuracy: { $avg: { $ifNull: ['$results.accuracy', 0] } },
        totalTime: { $sum: { $ifNull: ['$results.totalTime', 0] } },
        score: { $sum: { $ifNull: ['$results.score', 0] } }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
};

// Последняя сессия пользователя
trainingSchema.statics.getLastSession = async function(userId) {
  return this.findOne({ userId, completed: true }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Training', trainingSchema); 
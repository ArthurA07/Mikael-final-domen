const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Имя обязательно'],
    trim: true,
    maxlength: [50, 'Имя не должно превышать 50 символов']
  },
  email: {
    type: String,
    required: [true, 'Email обязателен'],
    unique: true,
    lowercase: true,
    match: [/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, 'Введите корректный email']
  },
  password: {
    type: String,
    required: [true, 'Пароль обязателен'],
    minlength: [6, 'Пароль должен содержать минимум 6 символов'],
    select: false
  },
  phone: {
    type: String,
    default: null,
    match: [/^(\+7|8)?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/, 'Введите корректный номер телефона']
  },
  avatar: {
    type: String,
    default: null
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  // Настройки тренажёра по умолчанию
  trainerSettings: {
    totalProblems: {
      type: Number,
      default: 10,
      min: 1,
      max: 100
    },
    numbersCount: {
      type: Number,
      default: 3,
      min: 1,
      max: 15
    },
    numberRange: {
      type: Number,
      default: 9,
      enum: [9, 99, 999, 999999, 1000000]
    },
    numberRangeMin: {
      type: Number,
      default: 1,
      min: 1
    },
    operations: {
      type: [String],
      default: ['+'],
      enum: ['+', '-', '*', '/']
    },
    displaySpeed: {
      type: Number,
      default: 2000, // миллисекунды
      min: 100,
      max: 10000
    },
    displayMode: {
      type: String,
      default: 'digits',
      enum: ['digits', 'abacus']
    },
    // Новые настройки тренажёра (ограничения по ТЗ)
    multiplyDigits1: { type: Number, min: 1, max: 3, default: undefined },
    multiplyDigits2: { type: Number, min: 1, max: 3, default: undefined },
    multiplyDigits3: { type: Number, min: 1, max: 3, default: undefined },
    divisionDividendDigits: { type: Number, min: 1, max: 6, default: undefined },
    divisionDivisorDigits: { type: Number, min: 1, max: 4, default: undefined },
    divisionSecondDivisorDigits: { type: Number, min: 1, max: 4, default: undefined },
    preStartPause: { type: Number, min: 0, max: 60, default: 0 },
    answerPause: { type: Number, min: 0, max: 120, default: 0 },
    resultPause: { type: Number, min: 0, max: 60, default: 0 },
    fontScale: { type: Number, min: 0.5, max: 3, default: 1 },
    randomPosition: { type: Boolean, default: false },
    randomColor: { type: Boolean, default: false },
    sequentialDisplay: { type: Boolean, default: false },
    soundEnabled: {
      type: Boolean,
      default: true
    },
    voiceInput: {
      type: Boolean,
      default: false
    },
    showAnswer: {
      type: Boolean,
      default: true
    },
    twoScreens: {
      type: Boolean,
      default: false
    },
    lawsMode: {
      type: String,
      default: 'none',
      enum: ['none', 'five', 'ten', 'both']
    },
    progressiveMode: {
      type: Boolean,
      default: false
    },
    // Настройки отображения
    randomPosition: {
      type: Boolean,
      default: false
    },
    randomColor: {
      type: Boolean,
      default: false
    },
    randomFont: {
      type: Boolean,
      default: false
    }
  },
  // Общая статистика
  stats: {
    totalExercises: {
      type: Number,
      default: 0
    },
    correctAnswers: {
      type: Number,
      default: 0
    },
    totalTime: {
      type: Number,
      default: 0
    },
    bestAccuracy: {
      type: Number,
      default: 0,
      max: 100
    },
    currentStreak: {
      type: Number,
      default: 0
    },
    longestStreak: {
      type: Number,
      default: 0
    },
    level: {
      type: Number,
      default: 1
    },
    experiencePoints: {
      type: Number,
      default: 0
    }
  },
  // Достижения
  achievements: [{
    id: String,
    name: String,
    description: String,
    unlockedAt: Date,
    icon: String
  }],
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // Настройки интерфейса
  preferences: {
    theme: {
      type: String,
      default: 'light',
      enum: ['light', 'dark']
    },
    language: {
      type: String,
      default: 'ru',
      enum: ['ru', 'en']
    },
    fontSize: {
      type: String,
      default: 'medium',
      enum: ['small', 'medium', 'large']
    }
  }
}, {
  timestamps: true
});

// Поля для восстановления пароля
userSchema.add({
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpire: {
    type: Date,
    default: null
  }
});

// Хэширование пароля перед сохранением
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Метод для проверки пароля
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Метод для получения публичных данных пользователя
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', userSchema); 
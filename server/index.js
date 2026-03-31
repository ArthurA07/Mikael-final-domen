const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
// Загружаем .env; если отсутствует, подхватим config.example.env как дефолты
dotenv.config();
if (!process.env.MONGODB_URI) {
  const exampleEnvPath = path.join(__dirname, 'config.example.env');
  if (fs.existsSync(exampleEnvPath)) {
    dotenv.config({ path: exampleEnvPath });
  }
}

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const trainingRoutes = require('./routes/training');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');
const User = require('./models/User');

const app = express();

// Middleware
// CORS:
// - В проде ограничиваем origin списком из CORS_ORIGINS
// - В деве разрешаем localhost:* (чтобы не ломаться из-за занятого порта 3000/5000)
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Запросы без Origin (curl/health checks) — разрешаем
    if (!origin) return cb(null, true);
    // Если список не задан — разрешаем всем (полезно для локалки/тестов)
    if (!allowedOrigins.length) return cb(null, true);
    // Разрешаем из списка
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Dev-исключение: разрешаем localhost на любом порту
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/i.test(origin)) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
// Helmet + CSP (безопасные дефолты; доп. источники можно задать через env CSP_CONNECT_SRC="https://mikael-final.onrender.com")
const publicAppUrl = process.env.PUBLIC_APP_URL || '';
const isHttpsPublic = /^https:\/\//i.test(publicAppUrl);
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      // Разрешаем Google Fonts CSS (иначе шрифты не подтягиваются)
      "style-src": ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      "img-src": ["'self'", 'data:', 'blob:'],
      "connect-src": ["'self'", ...((process.env.CSP_CONNECT_SRC || 'https:').split(',').map(s => s.trim()).filter(Boolean))],
      "object-src": ["'none'"],
      "frame-ancestors": ["'none'"],
      // ВАЖНО: без HTTPS этот заголовок ломает страницу (браузер начинает грузить /static/* по https://).
      // В Helmet директивы из useDefaults могут включать upgrade-insecure-requests, поэтому явно управляем.
      "upgrade-insecure-requests": isHttpsPublic ? [] : null,
    },
  } : undefined,
}));
app.use(mongoSanitize());
app.use(xss());
// Request ID для логов
morgan.token('rid', (req) => req.id || '-');
app.use((req, res, next) => { try { req.id = require('crypto').randomUUID(); } catch {} next(); });
// Проставляем X-Request-Id в ответ для трейсинга
app.use((req, res, next) => { if (req.id) res.set('X-Request-Id', req.id); next(); });
app.use(morgan(process.env.NODE_ENV !== 'production' ? ':rid :method :url :status :response-time ms' : ':rid :method :url :status :response-time ms'));

// Staging noindex header to prevent accidental indexing
app.use((req, res, next) => {
  if (process.env.STAGING === 'true') {
    res.set('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 });
const forgotLimiter = rateLimit({ windowMs: 60 * 1000, max: 3 });
app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/forgot-password', forgotLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Mental Arithmetic Trainer API is running' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: {
      message: error.message || 'Внутренняя ошибка сервера'
    }
  });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/build');
  app.use(express.static(clientBuildPath));
  // Override robots.txt on staging to disallow all crawlers
  app.get('/robots.txt', (req, res, next) => {
    if (process.env.STAGING === 'true') {
      res.type('text/plain').send('User-agent: *\nDisallow: /');
      return;
    }
    next();
  });
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// 404 handler for API only
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: { message: 'Маршрут не найден' } });
});

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mental-arithmetic';
const USE_IN_MEMORY_DB = (process.env.USE_IN_MEMORY_DB || '').toLowerCase() === 'true';

async function seedAdmin() {
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin123!';
    let admin = await User.findOne({ email });
    if (!admin) {
      admin = await User.create({ name: 'Admin', email, password, role: 'admin' });
      console.log(`Admin user created: ${email}`);
    } else if (admin.role !== 'admin') {
      admin.role = 'admin';
      await admin.save();
      console.log(`User elevated to admin: ${email}`);
    } else {
      console.log('Admin user exists');
    }
  } catch (e) {
    console.warn('Admin seed warning:', e?.message || e);
  }
}

async function startServer() {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });
}

async function connectMongoWithFallback() {
  try {
    if (USE_IN_MEMORY_DB) {
      throw new Error('FORCE_IN_MEMORY');
    }
    await mongoose.connect(MONGODB_URI);
    console.log('Подключение к MongoDB успешно установлено');
    await seedAdmin();
    await startServer();
  } catch (err) {
    if (err && (err.message === 'FORCE_IN_MEMORY' || err.name === 'MongooseServerSelectionError')) {
      console.warn('Основная база недоступна, запускаю in-memory MongoDB с локальным дисковым хранилищем...');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        // Важно: не используем тот же путь, что и docker-mongo (`_data/mongo`).
        // И ещё важнее: при рестартах nodemon старый mongod может ещё жить,
        // поэтому делаем УНИКАЛЬНЫЙ dbPath на каждый запуск.
        const baseDir = process.env.MEM_DB_PATH || path.join(__dirname, '../_data/mongo-mem');
        try { fs.mkdirSync(baseDir, { recursive: true }); } catch {}
        const instanceDir = path.join(baseDir, `instance-${(require('crypto').randomUUID?.() || Date.now())}`);
        try { fs.mkdirSync(instanceDir, { recursive: true }); } catch {}
        console.log(`Путь к локальному хранилищу Mongo: ${instanceDir}`);
        const mongoServer = await MongoMemoryServer.create({
          instance: {
            dbPath: instanceDir,
            storageEngine: 'wiredTiger',
          },
        });
        const memUri = mongoServer.getUri();
        await mongoose.connect(memUri);
        console.log('Подключение к in-memory MongoDB (persistent dbPath) установлено');
        await seedAdmin();
        await startServer();
      } catch (memErr) {
        console.error('Не удалось запустить in-memory MongoDB:', memErr);
        process.exit(1);
      }
    } else {
      console.error('Ошибка подключения к MongoDB:', err);
      process.exit(1);
    }
  }
}

connectMongoWithFallback();

module.exports = app; 
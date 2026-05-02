# 🧮 Тренажёр Ментальной Арифметики

Полнофункциональное веб-приложение для обучения ментальной арифметике с интерактивным тренажёром и виртуальным абакусом.

## 🚀 Возможности

### 🎯 Основные функции
- **Числовой тренажёр** - интерактивные упражнения для развития навыков устного счёта
- **Виртуальный абакус (соробан)** - интерактивные счёты для изучения основ ментальной арифметики
- **Система достижений** - мотивирующие награды и отслеживание прогресса
- **Персональная статистика** - детальный анализ результатов и улучшений
- **Адаптивный дизайн** - работает на всех устройствах

### ⚙️ Настройки тренажёра
- Количество чисел в примере (1-10)
- Диапазон чисел (1-10000)
- Арифметические операции (+, -, *, /)
- Скорость показа чисел (0.1-10 сек)
- Режим отображения (цифры или абакус)
- Озвучивание чисел
- Голосовой ввод ответов
- Случайное позиционирование элементов
- Прогрессивное усложнение

### 👤 Система пользователей
- Регистрация и аутентификация
- Профили пользователей с настройками
- Сохранение прогресса и настроек
- История тренировок
- Система достижений и наград

## 🛠 Технологический стек

### Frontend
- **React 18** с TypeScript
- **Material-UI (MUI)** для UI компонентов
- **React Router** для навигации
- **Axios** для HTTP запросов
- **Framer Motion** для анимаций
- **Context API** для управления состоянием

### Backend
- **Node.js** с Express
- **MongoDB** с Mongoose для базы данных
- **JWT** для аутентификации
- **bcryptjs** для хэширования паролей
- **express-validator** для валидации
- **express-rate-limit** для защиты от злоупотреблений

## 📋 Требования

- Node.js 20.x (рекомендуется, см. `.nvmrc`)
- MongoDB 4.4+
- npm или yarn

## 🚀 Установка и запуск

Актуальный операционный чеклист (локальный запуск, ветки, сверка с GitHub и сервером): `docs/LOCAL_RUNBOOK.md`.

### 1. Клонирование репозитория
\`\`\`bash
git clone <repository-url>
cd Mikael-final
\`\`\`

### 2. Установка зависимостей
\`\`\`bash
# Установка всех зависимостей одной командой
npm run install-all

# Или по отдельности:
npm install
cd server && npm install
cd ../client && npm install
\`\`\`

### 3. Настройка окружения

#### Серверная часть
Создайте файл \`.env\` в папке \`server\`:
\`\`\`env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/mental-arithmetic
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=30d
NODE_ENV=development
\`\`\`

#### Клиентская часть
Создайте файл \`.env\` в папке \`client\`:
\`\`\`env
REACT_APP_API_URL=http://localhost:5000/api
\`\`\`

### 4. Запуск MongoDB
Убедитесь, что MongoDB запущен на вашем компьютере:
\`\`\`bash
# macOS (с Homebrew)
brew services start mongodb-community

# Ubuntu/Debian
sudo systemctl start mongod

# Windows
net start MongoDB
\`\`\`

### 5. Запуск приложения

#### Разработка (оба сервера одновременно)
\`\`\`bash
npm run dev
\`\`\`

#### Запуск серверов по отдельности
\`\`\`bash
# Сервер (терминал 1)
npm run server

# Клиент (терминал 2)
npm run client
\`\`\`

### 6. Открытие приложения
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

## 🏗 Структура проекта

\`\`\`
Mikael-final/
├── client/                 # React приложение
│   ├── public/
│   ├── src/
│   │   ├── components/     # React компоненты
│   │   │   ├── common/     # Общие компоненты
│   │   │   └── layout/     # Компоненты макета
│   │   ├── contexts/       # React контексты
│   │   ├── pages/          # Страницы приложения
│   │   │   ├── auth/       # Страницы аутентификации
│   │   │   ├── dashboard/  # Личный кабинет
│   │   │   ├── trainer/    # Тренажёр
│   │   │   ├── abacus/     # Абакус
│   │   │   ├── profile/    # Профиль
│   │   │   ├── achievements/ # Достижения
│   │   │   └── stats/      # Статистика
│   │   ├── utils/          # Утилиты
│   │   └── types/          # TypeScript типы
│   └── package.json
├── server/                 # Node.js API
│   ├── models/             # Mongoose модели
│   ├── routes/             # Express маршруты
│   ├── middleware/         # Middleware функции
│   ├── index.js            # Главный файл сервера
│   └── package.json
├── package.json            # Корневая конфигурация
└── README.md
\`\`\`

## 🗄 API Endpoints

### Аутентификация
- \`POST /api/auth/register\` - Регистрация пользователя
- \`POST /api/auth/login\` - Вход в систему
- \`GET /api/auth/me\` - Получение текущего пользователя
- \`PUT /api/auth/profile\` - Обновление профиля
- \`PUT /api/auth/change-password\` - Смена пароля

### Пользователь
- \`GET /api/user/trainer-settings\` - Получение настроек тренажёра
- \`PUT /api/user/trainer-settings\` - Обновление настроек тренажёра
- \`GET /api/user/stats\` - Получение статистики пользователя
- \`PUT /api/user/stats\` - Обновление статистики
- \`GET /api/user/progress\` - Получение прогресса за период
- \`GET /api/user/training-history\` - История тренировок
- \`POST /api/user/achievements\` - Добавление достижения

### Тренировки
- \`POST /api/training/start\` - Создание новой тренировочной сессии
- \`GET /api/training/:id/problem\` - Получение нового примера
- \`POST /api/training/:id/answer\` - Отправка ответа
- \`POST /api/training/:id/complete\` - Завершение тренировки
- \`GET /api/training/:id\` - Информация о тренировке
- \`DELETE /api/training/:id\` - Отмена тренировки
- \`POST /api/training/generate-problems\` - Генерация пакета примеров

## 🚀 Развёртывание на Render.com

### 1. Подготовка репозитория
Убедитесь, что ваш код загружен в GitHub репозиторий.

### 2. Настройка базы данных
Создайте MongoDB Atlas кластер:
1. Зарегистрируйтесь на [MongoDB Atlas](https://cloud.mongodb.com)
2. Создайте новый кластер
3. Получите строку подключения

### 3. Развёртывание бэкенда
1. Зайдите на [Render.com](https://render.com)
2. Создайте новый Web Service
3. Подключите ваш GitHub репозиторий
4. Настройте параметры:
   - **Build Command**: \`cd server && npm install\`
   - **Start Command**: \`cd server && npm start\`
   - **Root Directory**: оставьте пустым

5. Добавьте переменные окружения:
   - \`MONGODB_URI\`: строка подключения к MongoDB Atlas
   - \`JWT_SECRET\`: случайная секретная строка
   - \`NODE_ENV\`: \`production\`

### 4. Развёртывание фронтенда
1. Создайте новый Static Site на Render
2. Подключите тот же репозиторий
3. Настройте параметры:
   - **Build Command**: \`cd client && npm install && npm run build\`
   - **Publish Directory**: \`client/build\`

4. Добавьте переменную окружения:
   - \`REACT_APP_API_URL\`: URL вашего бэкенда на Render

### 5. Настройка CORS
После развёртывания обновите настройки CORS в файле \`server/index.js\`:
\`\`\`javascript
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend-url.onrender.com'],
  credentials: true
}));
\`\`\`

## 🧪 Тестирование

\`\`\`bash
# Запуск тестов фронтенда
cd client && npm test

# Запуск тестов бэкенда (если добавлены)
cd server && npm test
\`\`\`

## 🤝 Участие в разработке

1. Форкните репозиторий
2. Создайте ветку функции (\`git checkout -b feature/amazing-feature\`)
3. Зафиксируйте изменения (\`git commit -m 'Add amazing feature'\`)
4. Отправьте в ветку (\`git push origin feature/amazing-feature\`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект лицензирован под MIT лицензией.

## 📞 Поддержка

Если у вас есть вопросы или предложения, создайте issue в репозитории.

---

## 📐 Архитектура

Схемы и диаграммы находятся в файле `docs/ARCHITECTURE.md` (Mermaid).

---

**Автор**: Команда разработки Тренажёра Ментальной Арифметики  
**Версия**: 1.0.0  
**Статус**: В разработке 🚧 
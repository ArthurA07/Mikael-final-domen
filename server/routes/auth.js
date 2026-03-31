const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken, protect } = require('../middleware/auth');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const router = express.Router();

function buildResetEmailHtml(name, resetUrl, expireMinutes = 15) {
  const displayName = name ? name.split(' ')[0] : 'друг';
  return `
  <div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background:#f7f7fb; padding:24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #eef0f4;">
      <tr>
        <td style="padding:24px 24px 8px 24px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#4a58a3">Mikael Mental Arithmetic</div>
          <div style="margin-top:6px;font-size:12px;color:#7f8c8d;">Сброс пароля</div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 0 24px;">
          <p style="font-size:14px;color:#2c3e50;margin:0 0 12px 0;">Здравствуйте, ${displayName}!</p>
          <p style="font-size:14px;color:#2c3e50;margin:0 0 12px 0;">Вы запросили сброс пароля. Нажмите кнопку ниже, чтобы задать новый пароль.</p>
          <div style="text-align:center;margin:22px 0;">
            <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(45deg, #667eea, #764ba2);color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Сбросить пароль</a>
          </div>
          <p style="font-size:13px;color:#7f8c8d;margin:0 0 10px 0;">Ссылка действительна <strong>${expireMinutes} минут</strong>. Если вы не запрашивали сброс — просто игнорируйте это письмо.</p>
          <p style="font-size:12px;color:#95a5a6;margin:0;">Если кнопка не работает, скопируйте ссылку в браузер:<br/>
            <span style="word-break:break-all;color:#4a58a3">${resetUrl}</span>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px 24px 24px;text-align:center;">
          <div style="font-size:11px;color:#95a5a6;">© ${new Date().getFullYear()} Mikael. Все права защищены.</div>
        </td>
      </tr>
    </table>
  </div>`;
}

// Регистрация пользователя
router.post('/register', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Имя должно содержать от 2 до 50 символов'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Введите корректный email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Пароль должен содержать минимум 6 символов'),
  body('phone')
    .optional()
    .matches(/^(\+7|8)?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/)
    .withMessage('Введите корректный номер телефона')
], async (req, res) => {
  try {
    // Проверяем валидацию
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          message: 'Ошибки валидации',
          details: errors.array()
        }
      });
    }

    const { name, email, password, phone } = req.body;

    // Проверяем, существует ли пользователь с таким email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: {
          message: 'Пользователь с таким email уже существует'
        }
      });
    }

    // Создаём нового пользователя
    const user = await User.create({
      name,
      email,
      password,
      phone: phone || null
    });

    // Генерируем токен
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Пользователь успешно зарегистрирован',
      data: {
        token,
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при регистрации пользователя'
      }
    });
  }
});

// Вход пользователя
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Введите корректный email'),
  body('password')
    .notEmpty()
    .withMessage('Пароль обязателен')
], async (req, res) => {
  try {
    // Проверяем валидацию
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          message: 'Ошибки валидации',
          details: errors.array()
        }
      });
    }

    const { email, password } = req.body;

    // Ищем пользователя с включением поля password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Неверные учётные данные'
        }
      });
    }

    // Проверяем пароль
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: {
          message: 'Неверные учётные данные'
        }
      });
    }

    // Генерируем токен
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Вход выполнен успешно',
      data: {
        token,
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при входе в систему'
      }
    });
  }
});

// Получение текущего пользователя
router.get('/me', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при получении данных пользователя'
      }
    });
  }
});

// Обновление профиля пользователя
router.put('/profile', protect, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Имя должно содержать от 2 до 50 символов'),
  body('phone')
    .optional()
    .matches(/^(\+7|8)?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/)
    .withMessage('Введите корректный номер телефона'),
  body('avatar').optional().isString().withMessage('Ссылка на аватар должна быть строкой'),
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark'])
    .withMessage('Тема должна быть light или dark'),
  body('preferences.language')
    .optional()
    .isIn(['ru', 'en'])
    .withMessage('Язык должен быть ru или en')
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

    const allowedFields = ['name', 'phone', 'preferences'];
    const updates = {};
    
    Object.keys(req.body).forEach(field => {
      if (allowedFields.includes(field)) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Профиль успешно обновлён',
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при обновлении профиля'
      }
    });
  }
});

// Изменение пароля
router.put('/change-password', protect, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Текущий пароль обязателен'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Новый пароль должен содержать минимум 6 символов')
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

    const { currentPassword, newPassword } = req.body;

    // Получаем пользователя с паролем
    const user = await User.findById(req.user._id).select('+password');

    // Проверяем текущий пароль
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: {
          message: 'Неверный текущий пароль'
        }
      });
    }

    // Обновляем пароль
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Пароль успешно изменён'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: {
        message: 'Ошибка при изменении пароля'
      }
    });
  }
});

module.exports = router; 

// Восстановление пароля — запрос ссылки
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Введите корректный email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Ошибки валидации', details: errors.array() } });
    }
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: true, message: 'Если email существует, мы отправили ссылку' });

    const resetTokenRaw = crypto.randomBytes(20).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetTokenRaw).digest('hex');
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpire = new Date(Date.now() + 1000 * 60 * 15); // 15 минут
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.PUBLIC_APP_URL || 'https://mikael-final-1.onrender.com'}/reset-password?token=${resetTokenRaw}`;
    console.log('[auth] reset-password link:', resetUrl);

    // Транспорт для почты (минимальный SMTP, можно заменить на любой сервис)
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    const mailOptions = {
      from: process.env.SMTP_FROM || 'no-reply@mikael-final.app',
      to: email,
      subject: 'Восстановление пароля — Mikael',
      text: `Здравствуйте! Для сброса пароля перейдите по ссылке: ${resetUrl}\n\nСсылка действует 15 минут. Если вы не запрашивали сброс — просто игнорируйте это письмо.`,
      html: buildResetEmailHtml(user?.name, resetUrl, 15),
    };
    try { await transporter.sendMail(mailOptions); } catch (e) { console.warn('Mail send warning', e?.message); }

    res.json({ success: true, message: 'Если email существует, мы отправили ссылку' });
  } catch (e) {
    console.error('Forgot password error:', e);
    res.status(500).json({ error: { message: 'Ошибка восстановления пароля' } });
  }
});

// Установка нового пароля по токену
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Токен обязателен'),
  body('password').isLength({ min: 6 }).withMessage('Минимум 6 символов')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Ошибки валидации', details: errors.array() } });
    }
    const { token, password } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: tokenHash, resetPasswordExpire: { $gt: new Date() } }).select('+password');
    if (!user) return res.status(400).json({ error: { message: 'Токен недействителен или истёк' } });

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    res.json({ success: true, message: 'Пароль обновлён' });
  } catch (e) {
    console.error('Reset password error:', e);
    res.status(500).json({ error: { message: 'Ошибка обновления пароля' } });
  }
});
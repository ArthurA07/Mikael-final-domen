const express = require('express');
const jwt = require('jsonwebtoken');
const FreeAccess = require('../models/FreeAccess');
const User = require('../models/User');

const router = express.Router();

async function getSubscriptionAccess(user) {
  if (!user) return { allowed: false, reason: 'no_user' };
  const now = new Date();
  const paidUntil = user.subscription?.paidUntil ? new Date(user.subscription.paidUntil) : null;
  const isActive = user.subscription?.status === 'active' && !!paidUntil && paidUntil.getTime() > now.getTime();

  if (isActive) {
    return {
      allowed: true,
      reason: 'paid_active',
      paidUntil,
    };
  }

  // Автосинхронизация просроченной подписки
  if (user.subscription?.status === 'active' && paidUntil && paidUntil.getTime() <= now.getTime()) {
    user.subscription.status = 'expired';
    await user.save();
    return { allowed: false, reason: 'expired', paidUntil };
  }

  return {
    allowed: false,
    reason: user.subscription?.status === 'expired' ? 'expired' : 'subscription_required',
    paidUntil,
  };
}

// Публичная проверка бесплатного доступа по IP (20 минут с момента первого визита)
// Для авторизованных пользователей доступ есть только при активной оплаченной подписке.
router.post('/free-access', async (req, res) => {
  try {
    // Пытаемся распознать пользователя по токену, если он есть
    const authHeader = (req.headers.authorization || '').toString();
    if (authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          const subAccess = await getSubscriptionAccess(user);
          return res.json({
            success: true,
            data: {
              allowed: subAccess.allowed,
              reason: subAccess.reason,
              paidUntil: subAccess.paidUntil || null,
              authenticated: true,
            }
          });
        }
      } catch (e) {
        // игнорируем — просто считаем гостем
      }
    }

    const rawIp = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket?.remoteAddress || '').toString();
    const firstIp = rawIp.split(',')[0].trim();
    const ip = firstIp.replace('::ffff:', '');
    const whitelist = (process.env.FREE_ACCESS_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
    if (ip && whitelist.includes(ip)) {
      return res.json({ success: true, data: { allowed: true, reason: 'whitelist', ip } });
    }
    if (!ip) {
      return res.status(400).json({ success: false, error: { message: 'Не удалось определить IP' } });
    }

    const now = new Date();
    let record = await FreeAccess.findOne({ ip });

    if (record && record.blocked) {
      return res.json({ success: true, data: { allowed: false, reason: 'blocked', ip } });
    }

    if (!record) {
      const startedAt = now;
      const expiresAt = new Date(now.getTime() + 20 * 60 * 1000);
      try {
        record = await FreeAccess.create({ ip, startedAt, expiresAt });
      } catch (e) {
        // Возможна гонка: два параллельных запроса на один IP → E11000. В этом случае просто перечитываем запись.
        if (e && e.code === 11000) {
          record = await FreeAccess.findOne({ ip });
        } else {
          throw e;
        }
      }
      // только что созданная запись — ещё нет лимита
      return res.json({ success: true, data: { allowed: true, expiresAt, ip, exercisesUsed: 0 } });
    }

    // Проверяем лимит примеров для гостей
    const limit = parseInt(process.env.FREE_ACCESS_EXERCISES_LIMIT || '5', 10);
    if (!isNaN(limit) && record.exercisesUsed >= limit) {
      return res.json({ success: true, data: { allowed: false, reason: 'limit', ip, exercisesUsed: record.exercisesUsed } });
    }

    if (record.expiresAt > now) {
      return res.json({ success: true, data: { allowed: true, expiresAt: record.expiresAt, ip, exercisesUsed: record.exercisesUsed } });
    }

    return res.json({ success: true, data: { allowed: false, reason: 'expired', ip } });
  } catch (error) {
    console.error('Public free access error:', error);
    res.status(500).json({ success: false, error: { message: 'Ошибка при проверке доступа' } });
  }
});

// Трекинг использования одного примера гостем — инкремент счётчика с лимитом
router.post('/track-exercise', async (req, res) => {
  try {
    // Для авторизованных пользователей доступ зависит от оплаченной подписки.
    const authHeader = (req.headers.authorization || '').toString();
    if (authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          const subAccess = await getSubscriptionAccess(user);
          return res.json({
            success: true,
            data: {
              tracked: false,
              allowed: subAccess.allowed,
              reason: subAccess.reason,
              paidUntil: subAccess.paidUntil || null,
              authenticated: true,
            }
          });
        }
      } catch (e) {
        // игнорируем — продолжаем как гость
      }
    }

    const rawIp = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket?.remoteAddress || '').toString();
    const firstIp = rawIp.split(',')[0].trim();
    const ip = firstIp.replace('::ffff:', '');
    if (!ip) return res.status(400).json({ success: false, error: { message: 'Не удалось определить IP' } });

    const now = new Date();
    const limit = parseInt(process.env.FREE_ACCESS_EXERCISES_LIMIT || '5', 10);
    let record = await FreeAccess.findOne({ ip });
    if (!record) {
      const startedAt = now;
      const expiresAt = new Date(now.getTime() + 20 * 60 * 1000);
      try {
        record = await FreeAccess.create({ ip, startedAt, expiresAt, exercisesUsed: 0 });
      } catch (e) {
        if (e && e.code === 11000) {
          record = await FreeAccess.findOne({ ip });
        } else {
          throw e;
        }
      }
    }

    if (record.blocked) {
      return res.json({ success: true, data: { allowed: false, reason: 'blocked', exercisesUsed: record.exercisesUsed } });
    }

    // если сессия истекла — считаем как новую
    if (record.expiresAt <= now) {
      record.startedAt = now;
      record.expiresAt = new Date(now.getTime() + 20 * 60 * 1000);
      record.exercisesUsed = 0;
    }
    record.exercisesUsed += 1;
    record.lastUsedAt = now;
    if (!isNaN(limit) && record.exercisesUsed >= limit) {
      record.blocked = true;
    }
    await record.save();

    return res.json({
      success: true,
      data: {
        allowed: !record.blocked,
        exercisesUsed: record.exercisesUsed,
        limit,
        blocked: record.blocked,
        expiresAt: record.expiresAt,
      }
    });
  } catch (e) {
    console.error('Public track-exercise error:', e);
    res.status(500).json({ success: false, error: { message: 'Ошибка учёта бесплатного доступа' } });
  }
});

module.exports = router;



const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const Payment = require('../models/Payment');
const User = require('../models/User');

const router = express.Router();

const TARIFFS = {
  1: 399,
  3: 999,
  6: 1799,
  12: 2999
};

function getYooKassaAuthHeader() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) return null;
  return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`;
}

async function yookassaRequest(path, method, body, idempotenceKey) {
  const authHeader = getYooKassaAuthHeader();
  if (!authHeader) {
    throw new Error('YOOKASSA_NOT_CONFIGURED');
  }

  const headers = {
    Authorization: authHeader,
    'Content-Type': 'application/json'
  };

  if (idempotenceKey) {
    headers['Idempotence-Key'] = idempotenceKey;
  }

  const response = await fetch(`https://api.yookassa.ru/v3/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.description || `YooKassa request failed (${response.status})`);
    err.details = data;
    throw err;
  }
  return data;
}

function addMonthsSafe(date, months) {
  const base = new Date(date);
  const day = base.getDate();
  const result = new Date(base);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const daysInTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, daysInTargetMonth));
  return result;
}

function getReturnUrl() {
  const fromEnv = process.env.YOOKASSA_RETURN_URL || process.env.PUBLIC_APP_URL;
  const base = (fromEnv || 'https://swift-mind.ru').replace(/\/+$/, '');
  return `${base}/profile?payment=return`;
}

router.post(
  '/yookassa/create',
  protect,
  [
    body('periodMonths')
      .isInt()
      .withMessage('periodMonths должен быть числом')
      .custom((value) => Object.prototype.hasOwnProperty.call(TARIFFS, String(value)))
      .withMessage('Недопустимый тариф')
  ],
  async (req, res) => {
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

      const periodMonths = Number(req.body.periodMonths);
      const amountRub = TARIFFS[periodMonths];
      const idempotenceKey = crypto.randomUUID();

      const vatCode = Number(process.env.YOOKASSA_VAT_CODE || 1); // 1 = без НДС
      const taxSystemCode = Number(process.env.YOOKASSA_TAX_SYSTEM_CODE || 2); // 2 = УСН доходы

      const paymentBody = {
        amount: {
          value: amountRub.toFixed(2),
          currency: 'RUB'
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: getReturnUrl()
        },
        description: `Подписка на ${periodMonths} мес. (Супер Математика)`,
        metadata: {
          userId: String(req.user._id),
          periodMonths: String(periodMonths)
        },
        receipt: {
          customer: {
            email: req.user.email
          },
          tax_system_code: taxSystemCode,
          items: [
            {
              description: `Доступ к онлайн-тренажеру ментальной арифметики (${periodMonths} мес.)`,
              quantity: '1.00',
              amount: {
                value: amountRub.toFixed(2),
                currency: 'RUB'
              },
              vat_code: vatCode,
              payment_mode: 'full_payment',
              payment_subject: 'service'
            }
          ]
        }
      };

      const created = await yookassaRequest('payments', 'POST', paymentBody, idempotenceKey);

      await Payment.create({
        user: req.user._id,
        yookassaPaymentId: created.id,
        idempotenceKey,
        periodMonths,
        amountRub,
        status: created.status === 'succeeded' ? 'succeeded' : 'pending',
        rawCreateResponse: created
      });

      return res.json({
        success: true,
        data: {
          paymentId: created.id,
          status: created.status,
          confirmationUrl: created?.confirmation?.confirmation_url || null
        }
      });
    } catch (error) {
      console.error('YooKassa create payment error:', error?.details || error);
      if (error?.message === 'YOOKASSA_NOT_CONFIGURED') {
        return res.status(500).json({ error: { message: 'ЮKassa не настроена на сервере' } });
      }
      return res.status(500).json({ error: { message: 'Ошибка при создании платежа' } });
    }
  }
);

router.post('/yookassa/webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    const event = payload.event;
    const object = payload.object || {};
    const paymentId = object.id;

    if (!event || !paymentId) {
      return res.status(400).json({ error: { message: 'Некорректный webhook' } });
    }

    const paymentRecord = await Payment.findOne({ yookassaPaymentId: paymentId });
    if (!paymentRecord) {
      // В редких случаях webhook может прийти раньше сохранения платежа.
      return res.json({ success: true, message: 'Webhook принят (платеж пока не найден локально)' });
    }

    paymentRecord.rawWebhookPayload = payload;

    if (event === 'payment.succeeded') {
      if (paymentRecord.status !== 'succeeded') {
        paymentRecord.status = 'succeeded';
        paymentRecord.paidAt = new Date();

        const user = await User.findById(paymentRecord.user);
        if (user) {
          const now = new Date();
          const currentPaidUntil = user.subscription?.paidUntil ? new Date(user.subscription.paidUntil) : null;
          const baseDate = currentPaidUntil && currentPaidUntil > now ? currentPaidUntil : now;
          const newPaidUntil = addMonthsSafe(baseDate, paymentRecord.periodMonths);

          user.subscription = {
            ...(user.subscription || {}),
            status: 'active',
            planMonths: paymentRecord.periodMonths,
            paidUntil: newPaidUntil,
            lastPaymentAt: now,
            lastPaymentId: paymentId
          };
          await user.save();
        }
      }
    } else if (event === 'payment.canceled') {
      paymentRecord.status = 'canceled';
      paymentRecord.canceledAt = new Date();
    }

    await paymentRecord.save();

    return res.json({ success: true });
  } catch (error) {
    console.error('YooKassa webhook error:', error);
    return res.status(500).json({ error: { message: 'Ошибка обработки webhook' } });
  }
});

router.get('/subscription', protect, async (req, res) => {
  try {
    return res.json({
      success: true,
      data: {
        subscription: req.user.subscription || { status: 'demo', planMonths: null, paidUntil: null }
      }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return res.status(500).json({ error: { message: 'Ошибка получения подписки' } });
  }
});

module.exports = router;

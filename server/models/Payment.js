const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    provider: {
      type: String,
      default: 'yookassa',
      index: true
    },
    yookassaPaymentId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    idempotenceKey: {
      type: String,
      default: null
    },
    periodMonths: {
      type: Number,
      required: true
    },
    amountRub: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'RUB'
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'canceled', 'failed'],
      default: 'pending',
      index: true
    },
    paidAt: {
      type: Date,
      default: null
    },
    canceledAt: {
      type: Date,
      default: null
    },
    rawCreateResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    rawWebhookPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);

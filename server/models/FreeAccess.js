const mongoose = require('mongoose');

const freeAccessSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true, index: true },
  startedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  blocked: { type: Boolean, default: false },
  exercisesUsed: { type: Number, default: 0 }, // сколько примеров показано/решено гостю
  lastUsedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('FreeAccess', freeAccessSchema); 
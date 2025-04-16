const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    method: { type: String, enum: ['card', 'account', 'kakao', 'naver'], required: true },
    amount: { type: Number, required: true }, // 총 결제 금액
    status: { type: String, enum: ['paid', 'cancelled', 'refunded'], default: 'paid' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    pgTransactionId: { type: String }, // PG사 거래 ID
    createdAt: { type: Date, default: Date.now }
  });
  
  module.exports = mongoose.model('Payment', paymentSchema);
const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['추가', '감소', '환불'], required: true }, // 적립, 사용, 환불, 관리자 조정 등
  amount: { type: Number, default: 0, required: true },
  description: { type: String },
  relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  createdAt: { type: Date, default: Date.now },
  totalAmount: { type: Number, default: 0 },
});

module.exports = mongoose.model('Point', pointSchema);
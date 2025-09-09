const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  box: { type: mongoose.Schema.Types.ObjectId, ref: 'Box', required: true },
  boxCount: { type: Number, default: 1 },

  paymentType: {
    type: String,
    enum: ['point', 'card', 'mixed'],
    required: true
  },
  paymentAmount: { type: Number, required: true },
  pointUsed: { type: Number, default: 0 },
  status: {
  type: String,
  enum: [
    'pending',          // 결제 전
    'paid',             // 결제 완료
    'cancel_requested', // 사용자가 결제취소 요청한 상태
    'cancelled',        // 관리자가 승인해서 결제 자체가 취소됨 (매입 전)
    'refunded',         // 환불 완료 (매입 후 or 이미 결제된 금액 환급)
    'shipped'           // 배송 진행
  ],
  default: 'paid'
},
  unboxedProduct: {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    decidedAt: Date
  },

  resultAction: {
    type: String,
    enum: ['delivery', 'refund', 'cancel'],
    default: null
  },

  refunded: {
    point: { type: Number, default: 0 },
    cash: { type: Number, default: 0 }
  },
  trackingNumber: {
    type: String,
  },
  trackingCompany: { type: String },
  createdAt: { type: Date, default: Date.now }
});

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ user: 1, status: 1, createdAt: -1 });
orderSchema.index({ user: 1, 'unboxedProduct.decidedAt': -1 });
orderSchema.index({ 'unboxedProduct.product': 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ user: 1, 'refunded.point': 1 });

module.exports = mongoose.model('Order', orderSchema);



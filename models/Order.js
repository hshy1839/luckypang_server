const mongoose = require('mongoose');

// 주문 스키마 정의
const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    box: { type: mongoose.Schema.Types.ObjectId, ref: 'Box' }, // 어떤 박스 구매인지
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        status: { type: String, enum: ['boxed', 'unboxed', 'shipped', 'refunded'], default: 'boxed' },
      }
    ],
    paymentAmount: { type: Number, required: true }, // 실제 결제한 금액
    pointUsed: { type: Number, default: 0 },
    deliveryFee: {
      point: { type: Number, default: 0 },
      cash: { type: Number, default: 0 }
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled', 'shipped', 'refunded'],
      default: 'pending'
    },
    createdAt: { type: Date, default: Date.now }
  });
  
  module.exports = mongoose.model('Order', orderSchema);
  
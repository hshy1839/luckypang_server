const mongoose = require('mongoose');

// 주문 스키마 정의
const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  account: [
    {
      accountName : {
        type: String,
        required: true,
      },
      accountNumber: {
        type: String,
        required: true,
      },
      accountBank: {
        type: String,
        required: true,
      }
    },
  ],
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      productName: {
        type: String,
        required: true,
      },
      sizes: [
        {
          size: { type: String, required: true },
          quantity: { type: Number, required: true },
        },
      ],
      price: {
        type: Number,
        required: true,
      },
      totalPrice: {
        type: Number,
        required: true,
      },
    },
  ],
  totalAmount: {
    type: Number,
    required: true, // 총 주문 금액
  },
  paymentStatus: {
    type: String,
    enum: ['결제 대기', '결제 완료', '결제 실패'], // 결제 상태
    default: '결제 대기',
  },
  orderStatus: {
    type: String,
    enum: ['처리 중', '주문 완료', '취소'], // 주문 상태
    default: '주문 완료',
  },
}, { timestamps: true });

// 주문 모델 생성
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;

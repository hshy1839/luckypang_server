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
    enum: ['Pending', 'Paid', 'Failed'], // 결제 상태
    default: 'Pending',
  },
  orderStatus: {
    type: String,
    enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'], // 주문 상태
    default: 'Processing',
  },
}, { timestamps: true });

// 주문 모델 생성
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;

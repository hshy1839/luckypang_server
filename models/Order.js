const mongoose = require('mongoose');

// 주문 스키마 정의
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 주문한 사용자 ID (User 모델 참조)
  products: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // 상품 ID (Product 모델 참조)
      name: { type: String, required: true },   // 상품 이름
      price: { type: Number, required: true },  // 상품 가격
      quantity: { type: Number, required: true }, // 주문 수량
      total: { type: Number, required: true }   // 해당 상품의 총 가격 (price * quantity)
    }
  ],
  totalAmount: { type: Number, required: true },  // 주문 총액 (모든 상품의 가격 합계)
  shippingAddress: {
    addressLine1: { type: String, required: true },  // 주소 1
    addressLine2: { type: String, required:true},                  // 주소 2 (선택 사항)
  },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    required: true, 
    default: 'pending' // 결제 상태 (예: 대기 중, 완료됨, 실패)
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'shipped', 'delivered', 'cancelled'],
    required: true,
    default: 'pending'  // 주문 상태 (예: 대기 중, 배송 중, 배송 완료, 취소됨)
  },
  createdAt: { type: Date, default: Date.now }, // 주문 생성 날짜
});

// 주문 모델 생성
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;

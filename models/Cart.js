// const mongoose = require('mongoose');

// // 장바구니 스키마 정의
// const cartSchema = new mongoose.Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//   },
//   productId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Product',
//     required: true,
//   },
//   productName: {
//     type: String,
//     required: true,
//   },
//   sizes: [
//     {
//       size: { type: String, required: true }, // 사이즈 (예: "S", "M", "L")
//       quantity: { type: Number, required: true, default: 1 }, // 수량
//     },
//   ],
//   price: {
//     type: Number,
//     required: true,
//   },
//   totalPrice: {
//     type: Number,
//     required: true,
//   },
// }, { timestamps: true });

// // 장바구니 모델 생성
// const Cart = mongoose.model('Cart', cartSchema);

// module.exports = Cart;

const mongoose = require('mongoose');

// 주문 스키마 정의
const shippingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    shippingAddress: {
        address: { type: String, required: true }, // 배송지 주소
        address2: { type: String, required: true }, // 배송지 주소
    },
});

// 주문 모델 생성
const Shipping = mongoose.model('Shipping', shippingSchema);

module.exports = Shipping;

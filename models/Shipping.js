const mongoose = require('mongoose');

// 주문 스키마 정의
const shippingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    shippingAddress: {
        name: { type: String, required: true }, // 수령인 이름
        phone: { type: String, required: true }, // 연락처
        address: { type: String, required: true }, // 배송지 주소
        address2: { type: String, required: true }, // 배송지 주소
        postalCode: { type: String, required: true }, // 우편번호
    },
});

// 주문 모델 생성
const Shipping = mongoose.model('Shipping', shippingSchema);

module.exports = Shipping;

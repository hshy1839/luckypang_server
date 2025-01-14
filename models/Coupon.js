const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  name: { type: String, required: true }, // 쿠폰 이름
  code: { type: String, required: true, unique: true }, // 쿠폰 코드
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true }, // 할인 유형
  discountValue: { type: Number, required: true }, // 할인 값
  validFrom: { type: Date, required: true }, // 시작 날짜
  validUntil: { type: Date, required: true }, // 만료 날짜
  applicableCategories: [String], // 적용 가능한 카테고리
  isActive: { type: Boolean, default: true }, // 활성 상태
  createdAt: { type: Date, default: Date.now }, // 생성 날짜
});

module.exports = mongoose.model('Coupon', couponSchema);

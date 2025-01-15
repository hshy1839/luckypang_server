const mongoose = require('mongoose');

// 상품 스키마 정의
const promotionSchema = new mongoose.Schema({
  name: { type: String, required: true },         // 상품 이름
  promotionImage: [{type: String, required: true}],      
  createdAt: { type: Date, default: Date.now },   // 상품 생성 날짜
});

// 상품 모델 생성
const Promotion = mongoose.model('Promotion', promotionSchema);

module.exports = { Promotion };

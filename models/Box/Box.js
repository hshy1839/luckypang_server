const mongoose = require('mongoose');


const boxSchema = new mongoose.Schema({
  name: { type: String, required: true },             // 박스 이름
  description: { type: String },                      // 설명
  price: { type: Number, required: true },            // 가격 (포인트 or 현금)
  isPublic: { type: Boolean, default: false },        // 공개 여부 (공개 시 유저가 구매 가능)
  type: { type: String, enum: ['event', 'limited', 'normal'], default: 'normal' }, // 박스 유형
  image: { type: String },                            // 대표 이미지 URL
  availableFrom: { type: Date },                      // 판매 시작일
  availableUntil: { type: Date },                     // 판매 종료일
  purchaseLimit: { type: Number },  
  actionCode: { type: String, unique: true },                  // 구매 제한 수량 (예: 1일 1회 등)
  
  // 등장 상품 설정 (상품 ID와 확률 포함)
  products: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    probability: { type: Number, required: true },  // 확률 (예: 10 = 10%)
  }],
  createdAt: { type: Date, default: Date.now },
});

boxSchema.pre('save', function(next) {
  const totalProb = this.products.reduce((sum, p) => sum + p.probability, 0);
  if (totalProb > 1) { // 1 === 100%
    return next(new Error('확률의 총합이 100%를 초과했습니다.'));
  }
  next();
});

module.exports = mongoose.model('Box', boxSchema);

const mongoose = require('mongoose');

const giftCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  type: { type: String, enum: ['box', 'product'], required: true },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'claimed'], default: 'pending' },
  box: { type: mongoose.Schema.Types.ObjectId, ref: 'Box' },   // box 선물 시 사용
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, // 해당 주문(박스/상품)
  createdAt: { type: Date, default: Date.now },
  claimedAt: { type: Date },
});

// 조회 패턴 최적화 인덱스
// 박스 선물 여부 확인: type=box + fromUser + order 로 빠르게 존재여부 체크
giftCodeSchema.index({ type: 1, fromUser: 1, order: 1 });

// box까지 함께 쓰고 싶다면 추가(선택)
giftCodeSchema.index({ type: 1, fromUser: 1, box: 1, order: 1 });

// 상태/생성일 필터링 자주 쓰면 (선택)
giftCodeSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('GiftCode', giftCodeSchema);

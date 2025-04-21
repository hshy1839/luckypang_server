const mongoose = require('mongoose');

const giftCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },  // 랜덤한 선물 코드
  type: { type: String, enum: ['box', 'product'], required: true }, // 선물 타입
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 보낸 사람
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 받은 사람 (입력 시점에 설정)
  status: { type: String, enum: ['pending', 'claimed'], default: 'pending' }, // 상태
  box: { type: mongoose.Schema.Types.ObjectId, ref: 'Box' }, // 박스 선물인 경우
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, // 주문 정보 (박스 or 언박싱 상품)
  createdAt: { type: Date, default: Date.now },
  claimedAt: { type: Date },
});

module.exports = mongoose.model('GiftCode', giftCodeSchema);

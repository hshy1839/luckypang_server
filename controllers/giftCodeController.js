const GiftCode = require('../models/GiftCode');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const JWT_SECRET = 'jm_shoppingmall';

const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

exports.createGiftCode = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const { type, boxId, orderId } = req.body;

    if (!['box', 'product'].includes(type)) {
      return res.status(400).json({ success: false, message: '잘못된 선물 타입입니다.' });
    }

    if (type === 'box' && (!boxId || !orderId)) {
      return res.status(400).json({ success: false, message: 'boxId와 orderId가 필요합니다.' });
    }

    if (type === 'product' && !orderId) {
      return res.status(400).json({ success: false, message: 'orderId가 필요합니다.' });
    }

    // ✅ 중복 검사 (order 기반)
    const existingGift = await GiftCode.findOne({
      type,
      order: new mongoose.Types.ObjectId(orderId),
      fromUser: userId,
    });

    if (existingGift) {
      return res.status(200).json({
        success: true,
        code: existingGift.code,
        giftId: existingGift._id,
        message: `이미 생성된 선물 코드입니다. ${existingGift.code}`,
      });
    }

    // ✅ 랜덤 코드 생성 (중복 방지)
    let code;
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 5) {
      code = generateCode();
      exists = await GiftCode.exists({ code });
      attempts++;
    }

    if (exists) {
      return res.status(500).json({ success: false, message: '선물 코드 생성 실패 (중복 과다)' });
    }

    // ✅ 새 GiftCode 생성
    const newGift = new GiftCode({
      code,
      type,
      fromUser: userId,
      box: boxId ? new mongoose.Types.ObjectId(boxId) : undefined,
      order: orderId ? new mongoose.Types.ObjectId(orderId) : undefined,
    });

    await newGift.save();

    return res.status(201).json({
      success: true,
      code: newGift.code,
      giftId: newGift._id,
      message: '선물 코드가 생성되었습니다.',
    });
  } catch (err) {
    console.error('🎁 선물 코드 생성 오류:', err);
    return res.status(500).json({ success: false, message: '서버 오류로 생성 실패' });
  }
};

exports.checkGiftCodeExists = async (req, res) => {
  try {
    const { type, boxId, orderId, fromUser } = req.query;

    if (!['box', 'product'].includes(type)) {
      return res.status(400).json({ success: false, message: '잘못된 타입입니다.' });
    }

    const query = { type };

    if (boxId) query.box = new mongoose.Types.ObjectId(boxId);
    if (orderId) query.order = new mongoose.Types.ObjectId(orderId);
    if (fromUser) query.fromUser = new mongoose.Types.ObjectId(fromUser); // ✅ 사용자 기준 확인 추가

    const existing = await GiftCode.findOne(query);

    return res.status(200).json({ success: true, exists: !!existing });
  } catch (err) {
    console.error('🎁 선물 코드 존재 확인 오류:', err);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
};


exports.claimGiftCode = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const toUserId = decoded.userId;

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: '코드를 입력해주세요.' });
    }

    const giftCode = await GiftCode.findOne({ code: code.toUpperCase().trim() });

    if (!giftCode) {
      return res.status(404).json({ success: false, message: '유효하지 않은 선물 코드입니다.' });
    }

    if (giftCode.status === 'claimed') {
      return res.status(400).json({ success: false, message: '이미 사용된 코드입니다.' });
    }

    if (String(giftCode.fromUser) === String(toUserId)) {
      return res.status(403).json({ success: false, message: '자신에게는 선물 코드를 사용할 수 없습니다.' });
    }

    // 주문 조회
    const order = await mongoose.model('Order').findById(giftCode.order);
    if (!order) {
      return res.status(404).json({ success: false, message: '주문 정보를 찾을 수 없습니다.' });
    }

    // 선물코드 수령 처리 먼저
    giftCode.toUser = toUserId;
    giftCode.status = 'claimed';
    giftCode.claimedAt = new Date();
    await giftCode.save();

    // 주문의 수령자 및 user 변경
    order.receivedBy = toUserId;
    if (giftCode.toUser) {
      console.log('👉 기존 user:', order.user);
      console.log('👉 변경할 toUser:', giftCode.toUser);

      order.user = giftCode.toUser;
    }
    await order.save();
    console.log('✅ 저장 후 user:', order.user);

    return res.status(200).json({
      success: true,
      message: '선물이 등록되었습니다!',
      giftType: giftCode.type,
    });
  } catch (err) {
    console.error('🎁 선물 코드 등록 오류:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};



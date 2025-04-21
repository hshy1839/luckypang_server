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
    });

    if (existingGift) {
      return res.status(200).json({
        success: true,
        code: existingGift.code,
        giftId: existingGift._id,
        message: '이미 생성된 선물 코드입니다.',
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

const jwt = require('jsonwebtoken');
const Shipping = require('../models/Shipping');
const JWT_SECRET = 'jm_shoppingmall';

exports.addToShipping = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '인증 토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    if (!userId) return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });

    // ✅ 요청 바디에서 수령인, 연락처, 메모 포함해서 추출
    const { recipient, phone, memo, postcode, address, address2, is_default } = req.body;

    if (!recipient || !phone || !postcode || !address || !address2) {
      return res.status(400).json({ success: false, message: '필수 배송지 정보가 누락되었습니다.' });
    }

    const shipping = new Shipping({
      userId,
      recipient,
      phone,
      memo: memo || '',
      is_default: is_default || false,
      shippingAddress: { postcode, address, address2 },
    });

    await shipping.save();

    return res.status(201).json({ success: true, message: '배송지 등록 완료', shipping });
  } catch (error) {
    console.error('배송지 추가 오류:', error);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

exports.getUserShippings = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '인증 토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    if (!userId) return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });

    // 사용자 배송지 목록 조회
    const shippings = await Shipping.find({ userId }).sort({ is_default: -1, _id: -1 });

    return res.status(200).json({ success: true, shippings });
  } catch (error) {
    console.error('배송지 조회 오류:', error);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

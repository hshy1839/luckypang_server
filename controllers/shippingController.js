const jwt = require('jsonwebtoken');
const Shipping = require('../models/Shipping');
const JWT_SECRET = 'jm_shoppingmall';

exports.addToShipping = async (req, res) => {
  try {
    // 1. JWT 토큰에서 유저 ID 추출
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '인증 토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    if (!userId) return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });

    // 2. 요청 바디에서 주소 정보 추출
    const { postcode, address, address2 } = req.body;
    if (!postcode || !address || !address2) {
      return res.status(400).json({ success: false, message: '주소 정보가 부족합니다.' });
    }

    // 3. DB에 저장
    const shipping = new Shipping({
      userId,
      shippingAddress: { postcode, address, address2 },
    });

    await shipping.save();

    return res.status(201).json({ success: true, message: '배송지 등록 완료', shipping });
  } catch (error) {
    console.error('배송지 추가 오류:', error);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

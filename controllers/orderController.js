const jwt = require('jsonwebtoken');
const Order = require('../models/Order');
const JWT_SECRET = 'jm_shoppingmall';
const mongoose = require("mongoose");

exports.addToOrder = async (req, res) => {
  try {
    // JWT에서 사용자 ID 추출
    const token = req.headers.authorization.split(' ')[1]; // Bearer 토큰
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = new mongoose.Types.ObjectId(decoded.userId);


    // 요청 본문에서 주문 데이터 가져오기
    const { account, items, totalAmount } = req.body;

    if (!account || !items || !totalAmount) {
      return res.status(400).json({ message: '필수 정보가 누락되었습니다.' });
    }

    // 주문 생성
    const newOrder = new Order({
      userId,
      account,
      items,
      totalAmount,
      paymentStatus: 'Pending',
      orderStatus: 'Processing',
    });

    // 저장
    await newOrder.save();

    res.status(201).json({ message: '주문이 성공적으로 생성되었습니다.', order: newOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류로 인해 주문을 생성할 수 없습니다.', error });
  }
};

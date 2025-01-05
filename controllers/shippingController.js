const jwt = require('jsonwebtoken');
const Shipping = require('../models/Shipping');
const JWT_SECRET = 'jm_shoppingmall';
const mongoose = require("mongoose");

exports.addToShipping = async (req, res) => {
  try {
    // JWT 토큰에서 사용자 ID 추출
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: '토큰이 제공되지 않았습니다.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = new mongoose.Types.ObjectId(decoded.userId);

    const { shippingAddress } = req.body;

    if (!shippingAddress) {
      return res.status(400).json({ message: '배송지 정보가 누락되었습니다.' });
    }

    // 배송 정보 생성
    const shipping = new Shipping({
      userId,
      shippingAddress,
    });

    // 데이터베이스에 저장
    const savedShipping = await shipping.save();

    res.status(201).json({ message: '배송 정보가 성공적으로 저장되었습니다.', shipping: savedShipping });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '배송 정보 저장 중 오류가 발생했습니다.', error: error.message });
  }
};

exports.updateToShipping = async (req, res) => {
    try {
      // JWT 토큰에서 사용자 ID 추출
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: '토큰이 제공되지 않았습니다.' });
      }
  
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = new mongoose.Types.ObjectId(decoded.userId);
  
      const { shippingAddress } = req.body;
  
      if (!shippingAddress) {
        return res.status(400).json({ message: '배송지 정보가 누락되었습니다.' });
      }
  
      // 사용자 ID에 해당하는 배송 정보 업데이트
      const updatedShipping = await Shipping.findOneAndUpdate(
        { userId },
        { shippingAddress },
        { new: true, upsert: true } // upsert를 사용하여 없으면 생성
      );
  
      res.status(200).json({ message: '배송 정보가 성공적으로 업데이트되었습니다.', shipping: updatedShipping });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '배송 정보 업데이트 중 오류가 발생했습니다.', error: error.message });
    }
  };
  
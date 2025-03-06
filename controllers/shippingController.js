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

    // 기존 배송 정보 조회
    const existingShipping = await Shipping.findOne({ userId });

    if (existingShipping) {
      // 기존 데이터가 있으면 수정
      existingShipping.shippingAddress = shippingAddress;
      const updatedShipping = await existingShipping.save();
      return res.status(200).json({
        message: '배송 정보가 성공적으로 업데이트되었습니다.',
        shipping: updatedShipping,
      });
    } else {
      // 기존 데이터가 없으면 새로 생성
      const shipping = new Shipping({
        userId,
        shippingAddress,
      });
      const savedShipping = await shipping.save();
      return res.status(201).json({
        message: '배송 정보가 성공적으로 저장되었습니다.',
        shipping: savedShipping,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: '배송 정보 저장 중 오류가 발생했습니다.',
      error: error.message,
    });
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

exports.getShipping = async (req, res) => {
  try {
    // JWT 토큰에서 사용자 ID 추출
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: '토큰이 제공되지 않았습니다.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = new mongoose.Types.ObjectId(decoded.userId);

    // 사용자 ID에 해당하는 배송 정보 조회
    const shipping = await Shipping.findOne({ userId });

    if (!shipping) {
      return res.status(404).json({ message: '배송 정보가 존재하지 않습니다.' });
    }

    res.status(200).json({ message: '배송 정보 조회 성공', shipping });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '배송 정보 조회 중 오류가 발생했습니다.', error: error.message });
  }
};

exports.getShippingById = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1]; // Bearer 토큰
    const decoded = jwt.verify(token, JWT_SECRET);
    const loggedInUserId = decoded.userId;

    // 클라이언트에서 전달된 userId (URL 파라미터에서 추출)
    const userId = req.params.id || loggedInUserId;

    // userId를 ObjectId 형식으로 변환
    let userObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch (err) {
      return res.status(400).json({ message: '유효하지 않은 사용자 ID 형식입니다.' });
    }


    // 해당 유저의 모든 배송지 정보 조회
    const shippings = await Shipping.find({ userId: userObjectId });

    if (!shippings || shippings.length === 0) {
      return res.status(404).json({ message: '해당 유저의 배송지 내역이 없습니다.' });
    }

    // 데이터를 사람이 읽기 쉽게 변환
    const shippingDetails = shippings.map((shipping) => {
      const {
        shippingAddress: {  address, address2 },
      } = shipping;

      return `주소: ${address}, 상세주소: ${address2}`;
    });

    res.status(200).json({
      message: '배송지 내역을 성공적으로 가져왔습니다.',
      shippingDetails,
    });
  } catch (error) {
    console.error('Error in getShippingById:', error);
    res.status(500).json({ message: '서버 오류로 인해 배송지 내역을 가져올 수 없습니다.', error });
  }
};

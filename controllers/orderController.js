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
    const { account, items, totalAmount, paymentStatus,  orderStatus} = req.body;

    if (!account || !items || !totalAmount) {
      return res.status(400).json({ message: '필수 정보가 누락되었습니다.' });
    }

    // 주문 생성
    const newOrder = new Order({
      userId,
      account,
      items,
      totalAmount,
      paymentStatus,
      orderStatus,
    });

    // 저장
    await newOrder.save();

    res.status(201).json({ message: '주문이 성공적으로 생성되었습니다.', order: newOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류로 인해 주문을 생성할 수 없습니다.', error });
  }
};

// 해당 유저의 주문 가져오기
exports.getOrdersByUser = async (req, res) => {
  try {
    // JWT에서 사용자 ID 추출
    const token = req.headers.authorization.split(' ')[1]; // Bearer 토큰
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = new mongoose.Types.ObjectId(decoded.userId);

    // 해당 유저의 모든 주문 가져오기
    const orders = await Order.find({ userId });

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: '해당 유저의 주문 내역이 없습니다.' });
    }

    res.status(200).json({ message: '주문 내역을 성공적으로 가져왔습니다.', orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류로 인해 주문 내역을 가져올 수 없습니다.', error });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    // 모든 주문 가져오기
    const orders = await Order.find({}).populate('userId', 'username email'); // 필요한 경우 userId를 참조하여 사용자 정보 포함

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: '주문 내역이 없습니다.' });
    }

    res.status(200).json({ message: '전체 주문 내역을 성공적으로 가져왔습니다.', orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류로 인해 주문 내역을 가져올 수 없습니다.', error });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params; // URL 파라미터로 주문 ID 가져오기
    const updates = req.body; // 요청 본문에서 업데이트할 데이터 가져오기

    // 디버깅: 요청 데이터 확인

    // 주문 ID가 유효한 ObjectId인지 확인
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error("유효하지 않은 주문 ID:", id);
      return res.status(400).json({ message: '유효하지 않은 주문 ID입니다.' });
    }

    // 업데이트할 주문 찾기
    const order = await Order.findById(id);

    if (!order) {
      console.error("주문을 찾을 수 없습니다. ID:", id);
      return res.status(404).json({ message: '주문을 찾을 수 없습니다.' });
    }

    // 디버깅: 찾은 주문 정보

    // 요청 본문에 포함된 필드만 업데이트
    Object.keys(updates).forEach((key) => {
      if (order[key] !== undefined) {
        order[key] = updates[key];
      } else {
        console.warn(`알 수 없는 필드: ${key}`);
      }
    });

    // 업데이트된 주문 저장
    const updatedOrder = await order.save();

    // 디버깅: 저장된 업데이트된 주문 정보
    console.log("업데이트된 주문 정보:", updatedOrder);

    res.status(200).json({ message: '주문이 성공적으로 업데이트되었습니다.', order: updatedOrder });
  } catch (error) {
    console.error('주문 업데이트 중 오류:', error);
    res.status(500).json({ message: '서버 오류로 인해 주문을 업데이트할 수 없습니다.', error });
  }
};





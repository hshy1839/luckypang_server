const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Point = require('../models/Point');
const Box  = require('../models/Box/Box');

const JWT_SECRET = 'jm_shoppingmall';

exports.addToOrder = async (req, res) => {
  try {
    // 🔐 인증
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: '토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = new mongoose.Types.ObjectId(decoded.userId);

    // 📦 요청 파라미터 추출
    const {
      box,
      boxCount = 1,
      paymentType,
      paymentAmount,
      pointUsed = 0,
      deliveryFee = {}
    } = req.body;

    // 📌 유효성 검사
    if (!box) return res.status(400).json({ message: '박스 ID가 필요합니다.' });
    if (paymentAmount === undefined || typeof paymentAmount !== 'number') {
      return res.status(400).json({ message: '유효한 결제 금액이 필요합니다.' });
    }
    if (!['point', 'card', 'mixed'].includes(paymentType)) {
      return res.status(400).json({ message: '결제 수단이 유효하지 않습니다.' });
    }

    // 📦 박스 존재 및 재고 확인
    const selectedBox = await Box.findById(box);
    if (!selectedBox) return res.status(404).json({ message: '해당 박스를 찾을 수 없습니다.' });

    if (selectedBox.stock !== undefined) {
      if (selectedBox.stock < boxCount) {
        return res.status(400).json({ message: '박스 재고가 부족합니다.' });
      }
      selectedBox.stock -= boxCount;
      await selectedBox.save();
    }

    // 🧾 주문 생성
    const newOrder = new Order({
      user: userId,
      box,
      boxCount,
      paymentType,
      paymentAmount,
      pointUsed,
      deliveryFee: {
        point: deliveryFee.point || 0,
        cash: deliveryFee.cash || 0
      },
      status: 'paid'
    });

    await newOrder.save();

    // 🪙 포인트 차감 내역 기록
    if (pointUsed > 0) {
      const userPoints = await Point.find({ user: userId });

      const currentTotal = userPoints.reduce((acc, p) => {
        if (['추가', '환불'].includes(p.type)) return acc + p.amount;
        if (p.type === '감소') return acc - p.amount;
        return acc;
      }, 0);

      const updatedTotal = currentTotal - pointUsed;

      
      const pointLog = new Point({
        user: userId,
        type: '감소',
        amount: pointUsed,
        description: '럭키박스 구매 사용',
        relatedOrder: newOrder._id,
        totalAmount: updatedTotal
      });

      await pointLog.save();
    }

    // ✅ 응답 반환
    return res.status(201).json({
      success: true,
      message: '주문이 성공적으로 완료되었습니다.',
      order: newOrder
    });

  } catch (error) {
    console.error('💥 주문 생성 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류로 인해 주문을 생성할 수 없습니다.'
    });
  }
};

exports.getOrdersByUserId = async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId가 필요합니다.' });
    }

    const orders = await Order.find({ user: userId, status: 'paid' }) // ✅ 조건 추가 가능
      .populate('box')   // 박스 정보 포함
      .populate('user')  // 유저 정보 포함 (필요시)
      .sort({ createdAt: -1 }); // 최근순 정렬 (선택)

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('💥 주문 목록 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류로 인해 주문을 조회할 수 없습니다.',
    });
  }
};

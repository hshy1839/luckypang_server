const { RestClient } = require('@bootpay/server-rest-client');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const Order = require('../models/Order');
const Box  = require('../models/Box/Box'); // 박스 모델
const JWT_SECRET = 'jm_shoppingmall';
const Point = require('../models/Point');
const Notification = require('../models/Notification');

// 부트페이 설정 (자주 안 바뀜, 앱아이디/키는 니꺼 맞는지 꼭 확인!)
RestClient.setConfig(
  '61e7c9c9e38c30001f7b824a', // BOOTPAY_APPLICATION_ID
  'TiqTbAKWuWAukzmhdSyrctXibabB3ZxM+9unvoAeQKc=' // BOOTPAY_PRIVATE_KEY
);

// POST /api/bootpay/verify
exports.verifyBootpayAndCreateOrder = async (req, res) => {
  try {
    // 1. 토큰으로 사용자 인증
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: '토큰 없음' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: '유저 없음' });

    // 2. 필수값 검증
    const { receipt_id, boxId, amount, paymentType, pointUsed,boxCount = 1 } = req.body;
    if (!receipt_id || !boxId || !amount || !paymentType) {
      return res.status(400).json({ message: '필수 값 누락' });
    }

    // 3. 부트페이 토큰 발급
    const tokenRes = await RestClient.getAccessToken();
    if (tokenRes.status !== 200 || !tokenRes.data.token) {
      return res.status(500).json({ message: '부트페이 토큰 발급 실패', detail: tokenRes.data });
    }

    // 4. 결제 영수증(검증)
    const verifyRes = await RestClient.verify(receipt_id);
    if (verifyRes.status !== 200 || !verifyRes.data) {
      return res.status(400).json({ message: '부트페이 결제 검증 실패', detail: verifyRes.data });
    }

    const verify = verifyRes.data;

    // 5. 결제상태/금액 검증
    if (verify.status !== 1) {
      return res.status(400).json({ message: '결제 미완료 (status!=1)', verify });
    }
    if (Number(verify.price) !== Number(amount)) {
      return res.status(400).json({ message: '결제 금액 불일치', verify });
    }

    // 6. 중복주문 체크 (receipt_id 기준)
    const existing = await Order.findOne({ externalOrderNo: verify.receipt_id });
    if (existing) {
      return res.status(200).json({ message: '이미 처리된 주문', orderId: existing._id });
    }

    // 7. 박스 체크
    const box = await Box.findById(boxId);
    if (!box) return res.status(404).json({ message: '박스 없음' });

    // 8. 주문 생성
    const createdOrders = [];
for (let i = 0; i < boxCount; i++) {
  const newOrder = new Order({
    user: user._id,
    box: box._id,
    boxCount: 1, // 단건 처리
    paymentType,
    paymentAmount: Math.floor(amount / boxCount), // n등분
    pointUsed: Math.floor((pointUsed || 0) / boxCount), // n등분
    deliveryFee: { point: 0, cash: 0 },
    status: 'paid',
    externalOrderNo: verify.receipt_id,
  });
  await newOrder.save();
  createdOrders.push(newOrder);
}
if (Notification && typeof Notification.create === 'function') {
  await Notification.create({
    userId: user._id,
    message: '박스 결제가 완료되었습니다.',
    url: '/order',
  });
} else {
  console.warn('[verifyBootpayAndCreateOrder] Notification model not available, skip creating notification.');
}


  console.log('🟢 새 주문 저장:', createdOrders.map(o => o._id));
if (pointUsed && pointUsed > 0) {
  // 현재 누적 포인트 계산
  const Point = require('../models/Point');
  const userPoints = await Point.find({ user: user._id });
  const currentTotal = userPoints.reduce((acc, p) => {
    if (['추가', '환불'].includes(p.type)) return acc + p.amount;
    if (p.type === '감소') return acc - p.amount;
    return acc;
  }, 0);

  const updatedTotal = currentTotal - pointUsed;

  // 로그 생성
  const pointLog = new Point({
    user: user._id,
    type: '감소',
    amount: pointUsed,
    description: '럭키박스 구매',
    relatedOrder: createdOrders[0]?._id,
    totalAmount: updatedTotal,
  });
  await pointLog.save();
}
    return res.status(200).json({
      success: true,
      message: '결제 확인 및 주문 생성 완료',
      orderId: createdOrders[0]?._id,
    });

  } catch (err) {
    console.error('💥 부트페이 결제 검증/주문 생성 에러', err);
    res.status(500).json({ message: '서버 오류', error: err.message });
  }
};

exports.verifyBootpayAndPayShipping = async (req, res) => {
  try {
    // 1. 토큰 인증
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: '토큰 없음' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: '유저 없음' });

    // 2. 필수값 체크
    const { receipt_id, orderId, amount, paymentType, pointUsed } = req.body;

    // 🚩 (1) 전액 포인트 결제 (PG 없이)
    if (paymentType === 'point') {
      if (!orderId) return res.status(400).json({ message: 'orderId 누락' });
      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ message: '주문 없음' });

      // 주문 배송비/상태 업데이트
      order.status = 'shipped'; // or 'delivery_paid'
      order.deliveryFee = { point: pointUsed || 0, cash: 0 };
      order.paymentType = 'point';
      await order.save();

      // 포인트 차감 로그
      if (pointUsed && pointUsed > 0) {
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
          description: '배송비 결제',
          relatedOrder: order._id,
          totalAmount: updatedTotal,
        });
        await pointLog.save();
      }

      return res.status(200).json({
        success: true,
        message: '포인트 배송비 결제 완료',
        orderId: order._id,
      });
    }

    // 🚩 (2) 일반 결제 (PG 결제)
    if (!receipt_id || !orderId || !amount || !paymentType) {
      return res.status(400).json({ message: '필수 값 누락' });
    }

    // 부트페이 결제 검증
    const tokenRes = await RestClient.getAccessToken();
    if (tokenRes.status !== 200 || !tokenRes.data.token) {
      return res.status(500).json({ message: '부트페이 토큰 발급 실패', detail: tokenRes.data });
    }
    const verifyRes = await RestClient.verify(receipt_id);
    if (verifyRes.status !== 200 || !verifyRes.data) {
      return res.status(400).json({ message: '부트페이 결제 검증 실패', detail: verifyRes.data });
    }
    const verify = verifyRes.data;
    if (verify.status !== 1) {
      return res.status(400).json({ message: '결제 미완료 (status!=1)', verify });
    }
    if (Number(verify.price) !== Number(amount)) {
      return res.status(400).json({ message: '결제 금액 불일치', verify });
    }

    // 기존 결제 내역 중복 체크
    const existing = await Order.findOne({ externalOrderNo: verify.receipt_id });
    if (existing) {
      return res.status(200).json({ message: '이미 처리된 주문', orderId: existing._id });
    }

    // 해당 주문 찾기
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: '주문 없음' });

    // 결제/배송 정보 갱신
    order.status = 'shipped'; // or 'delivery_paid'
    order.deliveryFee = { point: pointUsed || 0, cash: amount || 0 };
    order.paymentType = paymentType;
    order.externalOrderNo = verify.receipt_id;
    await order.save();

    await Notification.create({
  userId: user._id,
  message: '배송비 결제가 완료되었습니다.',
  url: '/order'
});
    // 포인트 차감 로그 (있으면)
    if (pointUsed && pointUsed > 0) {
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
        description: '배송비 결제',
        relatedOrder: order._id,
        totalAmount: updatedTotal,
      });
      await pointLog.save();
    }

    return res.status(200).json({
      success: true,
      message: '배송비 결제 및 상태 변경 완료',
      orderId: order._id,
    });

  } catch (err) {
    console.error('배송비 결제 검증/신청 에러', err);
    res.status(500).json({ message: '서버 오류', error: err.message });
  }
};

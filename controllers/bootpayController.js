const { RestClient } = require('@bootpay/server-rest-client');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const Order = require('../models/Order');
const Box  = require('../models/Box/Box'); // 박스 모델
const JWT_SECRET = 'jm_shoppingmall';

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
    const { receipt_id, boxId, amount, paymentType, pointUsed } = req.body;
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
    const newOrder = new Order({
      user: user._id,
      box: box._id,
      boxCount: 1,
      paymentType,
      paymentAmount: amount,
      pointUsed: pointUsed,
      deliveryFee: { point: 0, cash: 0 },
      status: 'paid',
      externalOrderNo: verify.receipt_id,
    });

    await newOrder.save();

    console.log('🟢 새 주문 저장:', newOrder);
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
    relatedOrder: newOrder._id,
    totalAmount: updatedTotal,
  });
  await pointLog.save();
}
    return res.status(200).json({
      success: true,
      message: '결제 확인 및 주문 생성 완료',
      orderId: newOrder._id,
    });

  } catch (err) {
    console.error('💥 부트페이 결제 검증/주문 생성 에러', err);
    res.status(500).json({ message: '서버 오류', error: err.message });
  }
};

const Coupon = require('../models/Coupon');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'jm_shoppingmall';
const Point = require('../models/Point');

exports.createCoupon = async (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ success: false, message: 'Token is required' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const { name, code, discountValue, validFrom, validUntil } = req.body;

    // discountType은 'point'로 고정!
    const discountType = 'point';

    if (!name || !code || !discountValue || !validFrom || !validUntil) {
      return res.status(400).json({ success: false, message: '모든 필드를 입력하세요.' });
    }

    const coupon = new Coupon({
      name,
      code,
      discountType,
      discountValue,
      validFrom,
      validUntil,
      isActive: true,
    });

    const createdCoupon = await coupon.save();

    return res.status(200).json({
      success: true,
      coupon: createdCoupon,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: '이미 존재하는 쿠폰 코드입니다.' });
    }
    console.error('쿠폰 생성 실패:', err);
    return res.status(500).json({
      success: false,
      message: '쿠폰 생성 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

exports.getAllCoupons = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    }
    jwt.verify(token, JWT_SECRET);

    const coupons = await Coupon.find().sort({ createdAt: -1 }); // 최근순 정렬
    if (!coupons || coupons.length === 0) {
      return res.status(404).json({ success: false, message: '쿠폰을 찾을 수 없습니다.' });
    }

    res.status(200).json({
      success: true,
      totalCoupons: coupons.length,
      coupons,
    });
  } catch (err) {
    console.error('모든 쿠폰 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

exports.getCoupon = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, message: '쿠폰 ID가 필요합니다.' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    }
    jwt.verify(token, JWT_SECRET);

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: '쿠폰을 찾을 수 없습니다.' });
    }

    return res.status(200).json({ success: true, coupon });
  } catch (err) {
    console.error('쿠폰 조회 실패:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

exports.deleteCoupon = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, message: '쿠폰 ID가 필요합니다.' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    }
    jwt.verify(token, JWT_SECRET);

    const deletedCoupon = await Coupon.findByIdAndDelete(id);
    if (!deletedCoupon) {
      return res.status(404).json({ success: false, message: '쿠폰을 찾을 수 없습니다.' });
    }

    return res.status(200).json({
      success: true,
      message: '쿠폰이 성공적으로 삭제되었습니다.',
    });
  } catch (err) {
    console.error('쿠폰 삭제 실패:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

exports.updateCoupon = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: '쿠폰 ID가 필요합니다.' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    }
    jwt.verify(token, JWT_SECRET);

    // discountType은 'point'로 고정 (혹시라도 값 들어와도 강제로 맞춤)
    updates.discountType = 'point';

    const updatedCoupon = await Coupon.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!updatedCoupon) {
      return res.status(404).json({ success: false, message: '쿠폰을 찾을 수 없습니다.' });
    }

    return res.status(200).json({
      success: true,
      coupon: updatedCoupon,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: '이미 존재하는 쿠폰 코드입니다.' });
    }
    console.error('쿠폰 수정 실패:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// POST /api/coupon/use
exports.useCoupon = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: '쿠폰 코드가 필요합니다.' });
    }

    const coupon = await Coupon.findOne({ code, isActive: true });
    if (!coupon) {
      return res.status(404).json({ success: false, message: '유효하지 않은 쿠폰입니다.' });
    }

    // 🔥 이미 사용한 쿠폰 체크
    const alreadyUsed = await Point.findOne({
      user: userId,
      description: { $regex: coupon.name }, // description에 쿠폰 이름 포함 여부
      type: '추가'
    });
    if (alreadyUsed) {
      return res.status(400).json({ success: false, message: '이미 사용한 쿠폰입니다.' });
    }

    const now = new Date();
    if (now < new Date(coupon.validFrom) || now > new Date(coupon.validUntil)) {
      return res.status(400).json({ success: false, message: '쿠폰 사용 가능 기간이 아닙니다.' });
    }

    const point = new Point({
      user: userId,
      type: '추가',
      amount: coupon.discountValue,
      description: `쿠폰 (${coupon.name}) 사용`,
    });
    await point.save();

    return res.status(200).json({
      success: true,
      message: `${coupon.discountValue}포인트가 적립되었습니다.`,
      point,
    });
  } catch (err) {
    console.error('쿠폰 사용 실패:', err);
    return res.status(500).json({ success: false, message: '쿠폰 사용 중 오류가 발생했습니다.' });
  }
};

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const { User } = require('../models/User');
const Point = require('../models/Point');
const Box = require('../models/Box/Box');
const axios = require('axios');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const GiftCode = require('../models/GiftCode');
const pLimit = require('p-limit').default;
const JWT_SECRET = 'jm_shoppingmall';

// 테스트키/엔드포인트 (사용중인 곳 없음: 필요시 유지)
const PAYLETTER_API_KEY = 'MzAyQTQxRDQ3NkQ4OTE2ODA4MjcwNUJDNTlBMkU3MEE=';
const PAYLETTER_CLIENT_ID = 'sales_test';
const PAYLETTER_ENDPOINT = 'https://testpgapi.payletter.com/v1.0/payments/request';

/* ─────────────────────────────────────────────
 * 공통 유틸
 * ───────────────────────────────────────────── */
function getUserIdFromReq(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId;
  } catch (_) {
    return null;
  }
}

function parsePageLimit(req, { defPage = 1, defLimit = 30, maxLimit = 100 } = {}) {
  let page = parseInt(req.query.page, 10);
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = defPage;
  if (!Number.isFinite(limit) || limit < 1) limit = defLimit;
  if (limit > maxLimit) limit = maxLimit;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function toBool(val, def = false) {
  if (val === undefined) return def;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return ['1', 'true', 'yes', 'y'].includes(val.toLowerCase());
  return def;
}

// 최소 필드만 내려보내기
const BOX_PICK = '_id name price mainImage';
const USER_PICK = '_id username email nickname profileImage';
const PRODUCT_PICK =
  '_id name brand consumerPrice mainImage mainImageUrl refundProbability';

// 안전 셀렉트 도우미
const pickFields = (doc, fields) => {
  if (!doc) return doc;
  const out = {};
  fields.split(/\s+/).forEach((f) => {
    if (!f) return;
    if (doc[f] !== undefined) out[f] = doc[f];
  });
  return out;
};

/* ─────────────────────────────────────────────
 * 가중치 상품 선택
 * items: [{ product, probability }, ...] with product populated
 * ───────────────────────────────────────────── */
function pickProductWeighted(items) {
  const valid = (items || []).filter((it) => it && it.product && it.product._id);
  if (valid.length === 0) return null;

  const weights = valid.map((it) => {
    const n = Number(it.probability);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    const idx = Math.floor(Math.random() * valid.length);
    return valid[idx].product;
  }

  let r = Math.random() * total;
  for (let i = 0; i < valid.length; i++) {
    if (r < weights[i]) return valid[i].product;
    r -= weights[i];
  }
  return valid[valid.length - 1].product;
}

/* ─────────────────────────────────────────────
 * 주문 생성
 * POST /api/order
 * ───────────────────────────────────────────── */
exports.addToOrder = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = new mongoose.Types.ObjectId(decoded.userId);

    const {
      box,
      boxCount = 1,
      paymentType,
      paymentAmount,
      pointUsed = 0,
      deliveryFee = {},
    } = req.body;

    if (!box) return res.status(400).json({ success: false, message: '박스 ID가 필요합니다.' });
    if (paymentAmount === undefined || typeof paymentAmount !== 'number') {
      return res.status(400).json({ success: false, message: '유효한 결제 금액이 필요합니다.' });
    }
    if (!['point', 'card', 'mixed'].includes(paymentType)) {
      return res.status(400).json({ success: false, message: '결제 수단이 유효하지 않습니다.' });
    }

    const selectedBox = await Box.findById(box);
    if (!selectedBox) return res.status(404).json({ success: false, message: '해당 박스를 찾을 수 없습니다.' });

    if (selectedBox.stock !== undefined) {
      if (selectedBox.stock < boxCount) {
        return res.status(400).json({ success: false, message: '박스 재고가 부족합니다.' });
      }
      selectedBox.stock -= boxCount;
      await selectedBox.save();
    }

    const createdOrders = [];
    for (let i = 0; i < boxCount; i++) {
      const newOrder = new Order({
        user: userId,
        box,
        boxCount: 1,
        paymentType,
        paymentAmount: Math.floor(paymentAmount / boxCount),
        pointUsed: Math.floor(pointUsed / boxCount),
        deliveryFee: {
          point: deliveryFee.point || 0,
          cash: deliveryFee.cash || 0,
        },
        status: 'paid',
      });
      await newOrder.save();
      createdOrders.push(newOrder);
    }

    await Notification.create({
      userId: userId,
      message: `박스 주문이 완료되었습니다.`,
      url: '/order',
    });

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
        relatedOrder: createdOrders[0]._id,
        totalAmount: updatedTotal,
      });

      await pointLog.save();
    }

    return res.status(201).json({
      success: true,
      message: `${createdOrders.length}개의 주문이 성공적으로 완료되었습니다.`,
      orders: createdOrders,
    });
  } catch (error) {
    console.error('💥 주문 생성 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류로 인해 주문을 생성할 수 없습니다.',
    });
  }
};

/* ─────────────────────────────────────────────
 * 주문 조회 (하위호환 + 선택적 페이징)
 * GET /api/orders?userId=...&paged=true&page=&limit=
 * ───────────────────────────────────────────── */
exports.getOrdersByUserId = async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId가 필요합니다.' });
    }

    const paged = toBool(req.query.paged, false);
    const criteria = { user: userId };
    const baseQuery = Order.find(criteria)
      .populate('box', BOX_PICK)
      .populate('user', USER_PICK)
      .populate('unboxedProduct.product', PRODUCT_PICK)
      .sort({ createdAt: -1 });

    if (!paged) {
      const orders = await baseQuery.exec();
      return res.status(200).json({ success: true, orders });
    }

    const { page, limit, skip } = parsePageLimit(req);
    const [items, totalCount] = await Promise.all([
      baseQuery.skip(skip).limit(limit).lean(),
      Order.countDocuments(criteria),
    ]);

    return res.status(200).json({ success: true, items, totalCount, page, pageSize: limit });
  } catch (error) {
    console.error('💥 주문 목록 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류로 인해 주문을 조회할 수 없습니다.',
    });
  }
};

/* ─────────────────────────────────────────────
 * 관리자: 전체 주문 조회 (변경 없음)
 * ───────────────────────────────────────────── */
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', USER_PICK)
      .populate('box', BOX_PICK)
      .populate('unboxedProduct.product', PRODUCT_PICK)
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('💥 전체 주문 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류로 인해 주문을 조회할 수 없습니다.',
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const orderId = req.params.id;
    if (!orderId) {
      return res.status(400).json({ success: false, message: '주문 ID가 필요합니다.' });
    }

    const order = await Order.findById(orderId)
      .populate('box', BOX_PICK)
      .populate('user', USER_PICK)
      .populate('unboxedProduct.product', PRODUCT_PICK);

    if (!order) {
      return res.status(404).json({ success: false, message: '해당 주문을 찾을 수 없습니다.' });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('💥 주문 단건 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류로 인해 주문을 조회할 수 없습니다.',
    });
  }
};

/* ─────────────────────────────────────────────
 * 박스 열기 (단건)
 * POST /api/orders/:id/unbox
 * ───────────────────────────────────────────── */
exports.unboxOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const requester = decoded.userId;

    const order = await Order.findById(orderId).select('user box unboxedProduct status');
    if (!order) return res.status(404).json({ success: false, message: '주문이 없습니다.' });
    if (String(order.user) !== String(requester)) {
      return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    }
    if (order.status !== 'paid') {
      return res.status(400).json({ success: false, message: '결제 완료 상태의 주문만 언박싱할 수 있습니다.' });
    }

    const box = await Box.findById(order.box).populate('products.product');
    if (!box || !Array.isArray(box.products) || box.products.length === 0) {
      return res.status(500).json({ success: false, message: '박스에 상품이 없습니다.' });
    }

    const selectedProduct = pickProductWeighted(box.products);
    if (!selectedProduct || !selectedProduct._id) {
      return res.status(500).json({ success: false, message: '상품 선택 실패' });
    }

    const updated = await Order.findOneAndUpdate(
      {
        _id: orderId,
        $or: [
          { 'unboxedProduct.product': { $exists: false } },
          { 'unboxedProduct.product': null },
        ],
      },
      {
        $set: {
          'unboxedProduct.product': selectedProduct._id,
          'unboxedProduct.decidedAt': new Date(),
        },
      },
      { new: true }
    );

    if (!updated) {
      const already = await Order.findById(orderId).populate('box user unboxedProduct.product');
      return res.status(400).json({
        success: false,
        message: '이미 박스가 열렸거나 처리 중입니다.',
        order: already || null,
      });
    }

    const populated = await Order.findById(updated._id)
      .populate('box', BOX_PICK)
      .populate('user', USER_PICK)
      .populate('unboxedProduct.product', PRODUCT_PICK);

    return res.status(200).json({ success: true, order: populated });
  } catch (err) {
    console.error('💥 박스 열기 오류:', err);
    return res.status(500).json({ success: false, message: err.message || '서버 오류' });
  }
};

/* ─────────────────────────────────────────────
 * 박스 열기 (배치)
 * POST /api/orders/unbox/batch
 * body: { orderIds: [] } (최대 10개)
 * ───────────────────────────────────────────── */
exports.unboxOrdersBatch = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const requester = decoded.userId;

    let { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: 'orderIds 배열이 필요합니다.' });
    }
    orderIds = orderIds.slice(0, 10);

    const limit = pLimit(3); // 동시에 3개씩 처리 (환경에 맞게 조절)

    const unboxOne = async (id) => {
      const base = await Order.findById(id).select('user box unboxedProduct status').exec();
      if (!base) return { orderId: id, success: false, order: null, message: '주문이 없습니다.' };
      if (String(base.user) !== String(requester)) {
        return { orderId: id, success: false, order: null, message: '권한이 없습니다.' };
      }
      if (base.status !== 'paid') {
        return { orderId: id, success: false, order: null, message: '결제 완료 상태 아님' };
      }

      const box = await Box.findById(base.box).populate('products.product').exec();
      if (!box || !Array.isArray(box.products) || box.products.length === 0) {
        return { orderId: id, success: false, order: null, message: '박스에 상품이 없습니다.' };
      }

      const selectedProduct = pickProductWeighted(box.products);
      if (!selectedProduct || !selectedProduct._id) {
        return { orderId: id, success: false, order: null, message: '상품 선택 실패' };
      }

      const updated = await Order.findOneAndUpdate(
        {
          _id: id,
          $or: [
            { 'unboxedProduct.product': { $exists: false } },
            { 'unboxedProduct.product': null },
          ],
        },
        {
          $set: {
            'unboxedProduct.product': selectedProduct._id,
            'unboxedProduct.decidedAt': new Date(),
          },
        },
        { new: true }
      ).exec();

      if (!updated) {
        const already = await Order.findById(id)
          .populate('box user unboxedProduct.product')
          .exec();
        return { orderId: id, success: false, order: already || null, message: '이미 열림 또는 처리 중' };
      }

      const populated = await Order.findById(updated._id)
        .populate('box', BOX_PICK)
        .populate('user', USER_PICK)
        .populate('unboxedProduct.product', PRODUCT_PICK)
        .exec();

      return { orderId: id, success: true, order: populated, message: null };
    };

    const settled = await Promise.allSettled(
      orderIds.map((id) => limit(() => unboxOne(id)))
    );

    const results = settled.map((r, idx) => {
      const id = orderIds[idx];
      if (r.status === 'fulfilled') return r.value;
      console.error('💥 배치 언박싱 개별 오류:', r.reason);
      return { orderId: id, success: false, order: null, message: r.reason?.message || '서버 오류' };
    });

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('💥 배치 언박싱 오류:', err);
    return res.status(500).json({ success: false, message: err.message || '서버 오류' });
  }
};


/* ─────────────────────────────────────────────
 * 언박싱 조회 (전체) – 기존
 * ───────────────────────────────────────────── */
exports.getUnboxedOrdersByUserId = async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId가 필요합니다.' });
    }

    const orders = await Order.find({
      user: userId,
      'unboxedProduct.product': { $exists: true, $ne: null },
    })
      .populate('box', BOX_PICK)
      .populate('user', USER_PICK)
      .populate({ path: 'unboxedProduct.product', model: 'Product', select: PRODUCT_PICK })
      .sort({ 'unboxedProduct.decidedAt': -1 });

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('💥 언박싱된 주문 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류로 인해 언박싱 내역을 조회할 수 없습니다.',
    });
  }
};

exports.getAllUnboxedOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      'unboxedProduct.product': { $exists: true, $ne: null },
      status: 'paid',
    })
      .populate('box', BOX_PICK)
      .populate('user', USER_PICK)
      .populate({ path: 'unboxedProduct.product', model: 'Product', select: PRODUCT_PICK })
      .sort({ 'unboxedProduct.decidedAt': -1 });

    return res.status(200).json({ success: true, total: orders.length, orders });
  } catch (error) {
    console.error('💥 전체 언박싱 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류로 인해 언박싱 내역을 조회할 수 없습니다.',
    });
  }
};

/* ─────────────────────────────────────────────
 * 환급
 * ───────────────────────────────────────────── */
exports.refundOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { refundRate, description } = req.body;

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const order = await Order.findById(orderId);
    if (!order || order.status !== 'paid') {
      return res.status(400).json({ success: false, message: '환급할 수 없는 주문입니다.' });
    }

    const refundAmount = Math.floor(((order.paymentAmount || 0) + (order.pointUsed || 0)) * (Number(refundRate) || 0) / 100);

    // refunded 필드 안전 가드
    if (!order.refunded) order.refunded = {};
    order.status = 'refunded';
    order.refunded.point = refundAmount;
    await order.save();

    const userPoints = await Point.find({ user: userId });
    const currentTotal = userPoints.reduce((acc, p) => {
      if (['추가', '환불'].includes(p.type)) return acc + p.amount;
      if (p.type === '감소') return acc - p.amount;
      return acc;
    }, 0);

    const updatedTotal = currentTotal + refundAmount;

    const refundLog = new Point({
      user: userId,
      type: '환불',
      amount: refundAmount,
      description: description || '포인트 환급',
      relatedOrder: order._id,
      totalAmount: updatedTotal,
    });
    await refundLog.save();

    return res.status(200).json({ success: true, refundedAmount: refundAmount });
  } catch (err) {
    console.error('❌ 환불 처리 오류:', err);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
};

/* ─────────────────────────────────────────────
 * 주문 업데이트
 * PATCH /api/order/:id
 * ───────────────────────────────────────────── */
exports.updateOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const updateFields = req.body;

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: '해당 주문을 찾을 수 없습니다.' });
    }


    const allowedFields = ['boxCount', 'paymentAmount', 'status', 'pointUsed', 'trackingNumber', 'trackingCompany'];
    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(updateFields, field)) {
        order[field] = updateFields[field];
      }
    });

    await order.save();

    const updatedOrder = await Order.findById(orderId)
      .populate('box', BOX_PICK)
      .populate('user', USER_PICK)
      .populate('unboxedProduct.product', PRODUCT_PICK);

    return res.status(200).json({
      success: true,
      message: '주문이 성공적으로 업데이트되었습니다.',
      order: updatedOrder,
    });
  } catch (err) {
    console.error('❌ 주문 수정 오류:', err);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
};

/* ─────────────────────────────────────────────
 * 운송장 업데이트 (관리자)
 * ───────────────────────────────────────────── */
exports.updateTrackingNumber = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { trackingNumber, trackingCompany } = req.body;

    if (!trackingNumber || !trackingCompany) {
      return res.status(400).json({ success: false, message: '운송장 번호, 택배사 이름이 필요합니다.' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user || user.user_type !== '1') {
      return res.status(403).json({ success: false, message: '관리자만 운송장 정보를 수정할 수 있습니다.' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: '해당 주문을 찾을 수 없습니다.' });
    }

    order.trackingNumber = trackingNumber;
    order.trackingCompany = trackingCompany;
    await order.save();

    return res.status(200).json({
      success: true,
      message: '운송장 정보가 성공적으로 저장되었습니다.',
      trackingNumber: order.trackingNumber,
      trackingCompany: order.trackingCompany,
    });
  } catch (err) {
    console.error('❌ 운송장 정보 저장 오류:', err);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
};

/* ─────────────────────────────────────────────
 * 신규: 박스 목록(미언박싱, paid) 페이지네이션
 * GET /api/orders/boxes?userId=&status=paid&unboxed=false&page=&limit=
 * ───────────────────────────────────────────── */
exports.getBoxesPaged = async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'userId가 필요합니다.' });

    const status = req.query.status || 'paid';
    const unboxed = req.query.unboxed === undefined ? 'false' : req.query.unboxed; // 'false' 기대

    const { page, limit, skip } = parsePageLimit(req);

    const criteria = {
      user: userId,
      status,
    };
    // 미언박싱: unboxed=false => unboxedProduct.product 존재X
    if (String(unboxed).toLowerCase() === 'false') {
      criteria['$or'] = [
        { 'unboxedProduct.product': { $exists: false } },
        { 'unboxedProduct.product': null },
      ];
    }

    const query = Order.find(criteria)
      .select('_id user box paymentType paymentAmount pointUsed createdAt status unboxedProduct giftCode trackingNumber trackingCompany')
      .populate('box', BOX_PICK)
      .sort({ createdAt: -1 })
      .lean();

    const [items, totalCount] = await Promise.all([
      query.skip(skip).limit(limit),
      Order.countDocuments(criteria),
    ]);

    // 클라에서 GiftCodeController로 giftCodeExists 확인 예정 → 서버는 그대로 전달
   const orderIds = items.map(o => o._id);
const userIdObj = new mongoose.Types.ObjectId(userId);

// GiftCode에서 type=box && fromUser=userId && orderId∈items 만 한 번에 조사
const gcs = await GiftCode.find({
  type: 'box',
  fromUser: userIdObj,
  orderId: { $in: orderIds },
}).select('fromUser boxId orderId type').lean();

// 빠른 조회를 위해 Set 구성( orderId 기준으로만 판단해도 충분 )
const giftedOrderIdSet = new Set(gcs.map(gc => String(gc.orderId)));

const enriched = items.map(o => ({
  ...o,
  giftCodeExists: giftedOrderIdSet.has(String(o._id)),
}));

return res.status(200).json({
  success: true,
  items: enriched,
  totalCount,
  page,
  pageSize: limit,
});
  } catch (e) {
    console.error('💥 getBoxesPaged 오류:', e);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
};

/* ─────────────────────────────────────────────
 * 신규: 언박싱 상품 페이지네이션
 * GET /api/orders/unboxed-products?userId=&status=(unshipped|shipped)&refunded=(true|false)&page=&limit=
 *  - status=unshipped: 배송 전(orders.status != 'shipped' 또는 tracking 없음) → 여기선 주문 status로 구분하지 않고
 *    언박싱된 주문 + 주문 status가 'paid' 이며, 주문 자체의 status==shipped는 클라에서 tracking 유무로 판단해도 됨
 *  - status=shipped: 주문 status === 'shipped' 기준 (혹은 tracking 존재)
 *  - refunded=false: order.status !== 'refunded' && refunded.point == 0
 * ───────────────────────────────────────────── */
exports.getUnboxedProductsPaged = async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'userId가 필요합니다.' });

    const status = (req.query.status || 'unshipped').toLowerCase(); // 'unshipped' | 'shipped'
    const refunded = req.query.refunded; // 'true' | 'false' | undefined

    const { page, limit, skip } = parsePageLimit(req);

    const criteria = {
      user: userId,
      'unboxedProduct.product': { $exists: true, $ne: null },
    };

    // 배송 상태 필터
    if (status === 'shipped') {
      criteria['status'] = 'shipped';
    } else if (status === 'unshipped') {
      // 아직 배송신청 X 라고 가정: status=paid
      criteria['status'] = 'paid';
    }

    // 환급 여부 필터
    if (refunded !== undefined) {
      const wantRefunded = toBool(refunded, false);
      if (wantRefunded) {
        // 환급된 것만
        criteria['$or'] = [
          { 'refunded.point': { $gt: 0 } },
          { status: 'refunded' },
        ];
      } else {
        // 환급 안 된 것만
        criteria['refunded.point'] = { $in: [0, null] };
        criteria['status'] = criteria['status'] || { $ne: 'refunded' };
      }
    }

    const query = Order.find(criteria)
      .select('_id user box paymentType paymentAmount pointUsed createdAt status unboxedProduct refunded trackingNumber trackingCompany')
      .populate('box', BOX_PICK)
      .populate({ path: 'unboxedProduct.product', model: 'Product', select: PRODUCT_PICK })
      .sort(status === 'shipped' ? { createdAt: -1 } : { 'unboxedProduct.decidedAt': -1 })
      .lean();

    const [items, totalCount] = await Promise.all([
      query.skip(skip).limit(limit),
      Order.countDocuments(criteria),
    ]);

    return res.status(200).json({
      success: true,
      items,
      totalCount,
      page,
      pageSize: limit,
    });
  } catch (e) {
    console.error('💥 getUnboxedProductsPaged 오류:', e);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
};

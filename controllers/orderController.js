  const jwt = require('jsonwebtoken');
  const mongoose = require('mongoose');
  const Order = require('../models/Order');
  const { User } = require('../models/User');
  const Point = require('../models/Point');
  const Box = require('../models/Box/Box');
  const axios = require('axios');
  const Product = require('../models/Product');


  const JWT_SECRET = 'jm_shoppingmall';

  const PAYLETTER_API_KEY = 'MzAyQTQxRDQ3NkQ4OTE2ODA4MjcwNUJDNTlBMkU3MEE=';
const PAYLETTER_CLIENT_ID = 'sales_test';
const PAYLETTER_ENDPOINT = 'https://testpgapi.payletter.com/v1.0/payments/request';

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

      const selectedBox = await Box.findById(box);
      if (!selectedBox) return res.status(404).json({ message: '해당 박스를 찾을 수 없습니다.' });

      if (selectedBox.stock !== undefined) {
        if (selectedBox.stock < boxCount) {
          return res.status(400).json({ message: '박스 재고가 부족합니다.' });
        }
        selectedBox.stock -= boxCount;
        await selectedBox.save();
      }

      // ✅ 주문 여러 개 생성
      const createdOrders = [];
      for (let i = 0; i < boxCount; i++) {
        const newOrder = new Order({
          user: userId,
          box,
          boxCount: 1, // 단건 처리
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

      // ✅ 포인트 차감 한 번만 처리
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
          relatedOrder: createdOrders[0]._id, // 대표 하나만 연결
          totalAmount: updatedTotal,
        });

        await pointLog.save();
      }

      // ✅ 응답
      return res.status(201).json({
        success: true,
        message: `${createdOrders.length}개의 주문이 성공적으로 완료되었습니다.`,
        orders: createdOrders,
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

  exports.getAllOrders = async (req, res) => {
    try {
      const orders = await Order.find()
        .populate('user')
        .populate('box')
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        orders,
      });
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
        .populate('box')
        .populate('user');

      if (!order) {
        return res.status(404).json({ success: false, message: '해당 주문을 찾을 수 없습니다.' });
      }

      return res.status(200).json({
        success: true,
        order,
      });
    } catch (error) {
      console.error('💥 주문 단건 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류로 인해 주문을 조회할 수 없습니다.',
      });
    }
  };

  // POST /api/orders/:id/unbox
  exports.unboxOrder = async (req, res) => {
    try {
      const orderId = req.params.id;

      const order = await Order.findById(orderId).populate('box');

      if (!order || order.unboxedProduct?.product) {
        return res.status(400).json({ success: false, message: '이미 박스가 열렸거나 주문이 없습니다.' });
      }

      const box = await Box.findById(order.box._id).populate('products.product');

      if (!box || !Array.isArray(box.products) || box.products.length === 0) {
        return res.status(500).json({ success: false, message: '박스에 상품이 없습니다.' });
      }

      const items = box.products;

      // 전체 확률 합산
      const totalProb = items.reduce((acc, item) => acc + Number(item.probability || 0), 0);
      const rand = Math.random() * totalProb;

      let sum = 0;
      let selected = null;

      for (let i = 0; i < items.length; i++) {
        const prob = Number(items[i].probability);
        if (isNaN(prob)) continue;
        sum += prob;
        if (rand <= sum) {
          selected = items[i].product;
          break;
        }
      }

      if (!selected || !selected._id) {
        console.error('❌ 선택된 상품이 없음');
        return res.status(500).json({ success: false, message: '상품 선택 실패' });
      }

      order.unboxedProduct = {
        product: selected._id,
        decidedAt: new Date(),
      };

      await order.save();
      console.log('✅ 박스 열기 완료, 저장됨');

      const updatedOrder = await Order.findById(orderId)
        .populate('box')
        .populate('user')
        .populate('unboxedProduct.product');

      return res.status(200).json({ success: true, order: updatedOrder });
    } catch (err) {
      console.error('💥 박스 열기 오류:', err.message);
      console.error(err.stack);
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  exports.getUnboxedOrdersByUserId = async (req, res) => {
    try {
      const userId = req.query.userId;

      if (!userId) {
        return res.status(400).json({ success: false, message: 'userId가 필요합니다.' });
      }

      const orders = await Order.find({
        user: userId,
        'unboxedProduct.product': { $exists: true, $ne: null },
        status: 'paid',
      })
        .populate('box')
        .populate('user')
        .populate({
          path: 'unboxedProduct.product',
          model: 'Product', // 명시적으로 Product 모델에서 조회
        })
        .sort({ 'unboxedProduct.decidedAt': -1 });

      return res.status(200).json({
        success: true,
        orders,
      });
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
        .populate('box')
        .populate('user', 'username email nickname profileImage') // 필요한 필드만 가져와도 되고
        .populate({
          path: 'unboxedProduct.product',
          model: 'Product',
        })
        .sort({ 'unboxedProduct.decidedAt': -1 });

      return res.status(200).json({
        success: true,
        total: orders.length,
        orders,
      });
    } catch (error) {
      console.error('💥 전체 언박싱 조회 오류:', error);
      return res.status(500).json({
        success: false,
        message: '서버 오류로 인해 언박싱 내역을 조회할 수 없습니다.',
      });
    }
  };



  exports.refundOrder = async (req, res) => {
    try {
      const orderId = req.params.id;
      const { refundRate, description } = req.body; // ✅ description 추가

      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: '토큰이 없습니다.' });

      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId;

      const order = await Order.findById(orderId);
      if (!order || order.status !== 'paid') {
        return res.status(400).json({ message: '환급할 수 없는 주문입니다.' });
      }

      const refundAmount = Math.floor((order.paymentAmount + order.pointUsed) * refundRate / 100);

      // 주문 상태 변경
      order.status = 'refunded';
      order.refunded.point = refundAmount;
      await order.save();

      // 포인트 총액 계산
      const userPoints = await Point.find({ user: userId });
      const currentTotal = userPoints.reduce((acc, p) => {
        if (['추가', '환불'].includes(p.type)) return acc + p.amount;
        if (p.type === '감소') return acc - p.amount;
        return acc;
      }, 0);

      const updatedTotal = currentTotal + refundAmount;

      // 포인트 환불 내역 추가
      const refundLog = new Point({
        user: userId,
        type: '환불',
        amount: refundAmount,
        description: description || '포인트 환급', // ✅ description 반영
        relatedOrder: order._id,
        totalAmount: updatedTotal
      });
      await refundLog.save();

      return res.status(200).json({
        success: true,
        refundedAmount: refundAmount
      });

    } catch (err) {
      console.error('❌ 환불 처리 오류:', err);
      return res.status(500).json({ success: false, message: '서버 오류' });
    }
  };

  // PATCH /api/order/:id
exports.updateOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const updateFields = req.body;

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: '토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: '해당 주문을 찾을 수 없습니다.' });
    }

    // 본인 주문만 수정 가능
    if (order.user.toString() !== userId) {
      return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    }

    // 수정 가능한 필드만 반영 (보안상 중요)
    const allowedFields = ['boxCount', 'paymentAmount', 'status', 'pointUsed'];
    allowedFields.forEach((field) => {
      if (updateFields.hasOwnProperty(field)) {
        order[field] = updateFields[field];
      }
    });

    await order.save();

    const updatedOrder = await Order.findById(orderId)
      .populate('box')
      .populate('user');

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

exports.updateTrackingNumber = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { trackingNumber } = req.body;

    if (!trackingNumber) {
      return res.status(400).json({ success: false, message: '운송장 번호가 필요합니다.' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: '토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // 관리자 권한 확인
    const user = await User.findById(userId);
    if (!user || user.user_type !== '1') {
      return res.status(403).json({ success: false, message: '관리자만 운송장 번호를 수정할 수 있습니다.' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: '해당 주문을 찾을 수 없습니다.' });
    }

    order.trackingNumber = trackingNumber;
    await order.save();

    return res.status(200).json({
      success: true,
      message: '운송장 번호가 성공적으로 저장되었습니다.',
      trackingNumber: order.trackingNumber,
    });
  } catch (err) {
    console.error('❌ 운송장 번호 저장 오류:', err);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
};


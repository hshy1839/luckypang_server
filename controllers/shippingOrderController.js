const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const ShippingOrder = require('../models/ShippingOrder');
const { User } = require('../models/User');
const Point = require('../models/Point');
const Product = require('../models/Product');
const Shipping = require('../models/Shipping');

const JWT_SECRET = 'jm_shoppingmall';

exports.createShippingOrder = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: '토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = new mongoose.Types.ObjectId(decoded.userId);

    const {
      product,
      shipping,
      orderId,
      paymentType,
      shippingFee,
      pointUsed = 0,
      paymentAmount
    } = req.body;

    if (!product || !shipping || !paymentType || shippingFee == null || paymentAmount == null) {
      return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
    }

    if (!['point', 'card', 'mixed'].includes(paymentType)) {
      return res.status(400).json({ message: '결제 수단이 유효하지 않습니다.' });
    }

    const foundProduct = await Product.findById(product);
    const foundShipping = await Shipping.findById(shipping);
    if (!foundProduct) return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    if (!foundShipping) return res.status(404).json({ message: '배송지를 찾을 수 없습니다.' });

    const newOrder = new ShippingOrder({
      user: userId,
      product,
      shipping,
      orderId,
      paymentType,
      shippingFee,
      pointUsed,
      paymentAmount,
      status: 'paid'
    });

    await newOrder.save();

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
        description: '배송비 결제 사용',
        relatedOrder: newOrder._id,
        totalAmount: updatedTotal,
      });

      await pointLog.save();
    }

    return res.status(201).json({
      success: true,
      message: '배송 주문이 완료되었습니다.',
      order: newOrder
    });
  } catch (error) {
    console.error('🚨 배송 주문 생성 오류:', error);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
};

exports.getShippingOrdersByUser = async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ message: 'userId가 필요합니다.' });

    const orders = await ShippingOrder.find({ user: userId, status: 'paid' })
      .populate('product')
      .populate('shipping')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('🚨 배송 주문 조회 오류:', error);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
};

exports.refundShippingOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { refundRate, description } = req.body;

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: '토큰이 없습니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const order = await ShippingOrder.findById(orderId);
    if (!order || order.status !== 'paid') {
      return res.status(400).json({ message: '환급할 수 없는 주문입니다.' });
    }

    const refundAmount = Math.floor((order.paymentAmount + order.pointUsed) * refundRate / 100);
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
      description: description || '배송비 환급',
      relatedOrder: order._id,
      totalAmount: updatedTotal
    });

    await refundLog.save();

    return res.status(200).json({ success: true, refundedAmount: refundAmount });
  } catch (err) {
    console.error('🚨 배송 주문 환불 오류:', err);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
};

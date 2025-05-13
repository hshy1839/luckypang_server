const express = require('express');
const {
  createShippingOrder,
  getShippingOrdersByUser,
  refundShippingOrder,
} = require('../controllers/shippingOrderController');

const router = express.Router();

// 디버깅용 미들웨어 (선택)
router.use((req, res, next) => {
  next();
});

// 배송 주문 생성
router.post('/shipping-orders', createShippingOrder);

// 유저별 배송 주문 조회
router.get('/shipping-orders', getShippingOrdersByUser);

// 배송 주문 환불 처리
router.post('/shipping-orders/:id/refund', refundShippingOrder);

module.exports = router;

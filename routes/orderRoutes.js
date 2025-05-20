const express = require('express');
const { 
    addToOrder, 
    getOrdersByUserId,
    getAllOrders,
    getOrderById,
    unboxOrder,
    getUnboxedOrdersByUserId,
    refundOrder,
    getAllUnboxedOrders,
    updateOrder,
    updateTrackingNumber,
} = require('../controllers/orderController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});

// 공지사항 추가
router.post('/order', addToOrder);
router.get('/order', getOrdersByUserId);

router.get('/orders', getAllOrders);
router.get('/orders/unboxed', getUnboxedOrdersByUserId);
router.get('/orders/unboxed/all', getAllUnboxedOrders);

router.post('/orders/:id/refund', refundOrder);
router.get('/orders/:id', getOrderById);
router.post('/orders/:id/unbox', unboxOrder);
router.patch('/order/:id', updateOrder);
router.patch('/order/:id/tracking', updateTrackingNumber);
module.exports = router;



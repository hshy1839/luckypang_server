const express = require('express');
const { 
    addToOrder, 
    getOrdersByUserId,
    getAllOrders,
    getOrderById,
    unboxOrder,
    getUnboxedOrdersByUserId,
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

router.get('/orders/:id', getOrderById);
router.post('/orders/:id/unbox', unboxOrder);
module.exports = router;



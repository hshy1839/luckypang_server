const express = require('express');
const { 
    addToOrder, 
    getOrdersByUserId,
} = require('../controllers/orderController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});

// 공지사항 추가
router.post('/order', addToOrder);
router.get('/order', getOrdersByUserId);

module.exports = router;



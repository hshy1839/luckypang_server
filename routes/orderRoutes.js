const express = require('express');
const { 
    addToOrder, 
} = require('../controllers/orderController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// 공지사항 추가
router.post('/order', addToOrder);

module.exports = router;



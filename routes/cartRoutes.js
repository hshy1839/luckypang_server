const express = require('express');
const { 
    addToCart, 
    getCartInfo,
    deleteCart,
} = require('../controllers/cartController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});

// 공지사항 추가
router.post('/cart', addToCart);
router.get('/cart/:userId', getCartInfo);
router.delete('/cart/delete/:id', deleteCart);

module.exports = router;



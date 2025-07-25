const express = require('express');
const { 
    addToShipping, 
    getUserShippings,
    updateShipping,
    deleteShipping,
} = require('../controllers/shippingController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});

// 배송지 추가
router.post('/shipping', addToShipping);
router.get('/shipping', getUserShippings);
router.put('/shipping/:id', updateShipping);
router.delete('/shipping/:id', deleteShipping);



module.exports = router;



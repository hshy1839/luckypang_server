const express = require('express');
const { 
    createCoupon, 
    getAllCoupons, 
    getCoupon,
    updateCoupon,
    deleteCoupon,
    useCoupon
} = require('../controllers/couponController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});

// 쿠폰 생성
router.post('/coupon', createCoupon);

// 모든 쿠폰 조회
router.get('/coupons', getAllCoupons);
router.get('/coupon/:id', getCoupon);
// 쿠폰 업데이트
router.put('/coupon/:id', updateCoupon);
// 쿠폰 삭제
router.delete('/coupon/:id', deleteCoupon);
router.post('/coupon/use', useCoupon);


module.exports = router;

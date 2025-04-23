const express = require('express');
const { 
    createGiftCode, 
    checkGiftCodeExists,
    claimGiftCode,
} = require('../controllers/giftCodeController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});


router.post('/giftCode', createGiftCode);
router.get('/giftCode', checkGiftCodeExists);

router.post('/giftCode/claim', claimGiftCode);


module.exports = router;

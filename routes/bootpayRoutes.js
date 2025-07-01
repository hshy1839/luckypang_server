const express = require('express');
const router = express.Router();
const { verifyBootpayAndCreateOrder } = require('../controllers/bootpayController.js'); // 컨트롤러 파일명 맞게!

router.use((req, res, next) => {
    next();
});

// POST /api/bootpay/verify
router.post('/bootpay/verify', verifyBootpayAndCreateOrder);

module.exports = router;

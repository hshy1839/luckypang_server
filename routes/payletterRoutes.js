const express = require('express');
const router = express.Router();
const { requestPayletterPayment, handleCallback } = require('../controllers/payletterController');



router.use((req, res, next) => {
    next();
});


router.post('/request', requestPayletterPayment);
router.post('/callback', handleCallback); // ✅ 콜백 추가

module.exports = router;

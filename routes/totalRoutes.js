const express = require('express');
const { 
    saveAccountInfo,
} = require('../controllers/totalController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

router.post('/account', saveAccountInfo);

module.exports = router;



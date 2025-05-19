const express = require('express');
const { 
    getTermByCategory,
    createTermByCategory,
} = require('../controllers/termController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});


    router.get('/terms/:category', getTermByCategory);
    router.post('/terms/:category', createTermByCategory);

module.exports = router;



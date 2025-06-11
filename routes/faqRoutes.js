const express = require('express');
const { 
    createFaq, 
    deleteFaq,
    getFaqById,
    getAllFaqs,
    updateFaq,
} = require('../controllers/faqController');

const router = express.Router();
const multer = require('multer');
const path = require('path');




// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});

// 공지사항 추가
router.post('/faq',createFaq);
router.delete('/faq', deleteFaq);
router.get('/faq/detail/:id', getFaqById);
router.get('/faq', getAllFaqs);

router.put('/faq/:id', updateFaq);

module.exports = router;

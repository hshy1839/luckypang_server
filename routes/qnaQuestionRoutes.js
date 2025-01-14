const express = require('express');
const { 
    createQuestion, 
    getQuestion,
    getAllQuestions,
    getQuestionById,
} = require('../controllers/qnaQuestionController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// 배송지 추가
router.post('/qnaQuestion', createQuestion);
router.get('/qnaQuestion/getinfo', getQuestion);
router.get('/qnaQuestion/getinfoAll', getAllQuestions);
router.get('/qnaQuestion/getinfoByid/:id', getQuestionById);

module.exports = router;



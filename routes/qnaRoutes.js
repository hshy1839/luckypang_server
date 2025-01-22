const express = require('express');
const {
    createQuestion,
    getQuestion,
    getAllQuestions,
    getQuestionById,
    getUnansweredQuestionsCount
} = require('../controllers/qnaQuestionController');
const {
    addAnswer, // 답변 등록 함수 추가
    getAnswersByQuestionId, // 질문에 연결된 답변 가져오기 함수 추가
} = require('../controllers/qnaAnswerController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});

// 질문 관련 라우트
router.post('/qnaQuestion', createQuestion);
router.get('/qnaQuestion/getinfo', getQuestion);
router.get('/qnaQuestion/getinfoAll', getAllQuestions);
router.get('/qnaQuestion/getinfoByid/:id', getQuestionById);
router.get('/qnaQuestion/unansweredCount', getUnansweredQuestionsCount);


// 답변 관련 라우트
router.post('/qnaQuestion/addAnswer/:id', addAnswer); // 특정 질문에 답변 추가
router.get('/qnaQuestion/getAnswers/:id', getAnswersByQuestionId); // 특정 질문에 연결된 답변 가져오기

module.exports = router;

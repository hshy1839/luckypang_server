const express = require('express');
const { 
    createPoint, 
    getPointsByUserId,
    updatePoint,
    deletePoint,
} = require('../controllers/pointController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});

// 공지사항 추가
router.post('/points/:id', createPoint);
// 공지사항 목록 조회
router.get('/points/:id', getPointsByUserId);
// 공지사항 삭제
router.delete('/points/:id', updatePoint);
// 공지사항 수정
router.put('/points/:id', deletePoint);

module.exports = router;

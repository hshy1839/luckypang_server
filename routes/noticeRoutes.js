const express = require('express');
const { 
    createNotice, 
    getAllNotice, 
    deleteNotice, 
    getNotice, 
    updateNotice
} = require('../controllers/noticeController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});

// 공지사항 추가
router.post('/notice', createNotice);
// 공지사항 목록 조회
router.get('/noticeList/find', getAllNotice);
// 공지사항 특정 조회
router.get('/noticeList/find-user/:id', getNotice);
// 공지사항 삭제
router.delete('/noticeList/delete/:id', deleteNotice);
// 공지사항 수정
router.put('/noticeList/update/:id', updateNotice);

module.exports = router;

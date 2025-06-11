const express = require('express');
const { 
    createNotice, 
    getAllNotices,
    getNoticeById,
    updateNotice,
    deleteNotice,
} = require('../controllers/noticeController');

const router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 파일의 fieldname에 따라 저장 경로를 다르게 설정
        if (file.fieldname === 'noticeImage') {
            cb(null, 'uploads/notice_images/'); 
         
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // 파일명에 타임스탬프 추가
    },
});


const upload = multer({ storage: storage }).fields([
    { name: 'noticeImage', maxCount: 1 },
]);


// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});

// 공지사항 추가
router.post('/notice', upload, createNotice);
router.get('/notice', getAllNotices);
router.get('/notice/:id', getNoticeById);
router.put('/notice/:id', upload, updateNotice);
router.delete('/notice/:id', deleteNotice);

module.exports = router;

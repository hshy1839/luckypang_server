const express = require('express');
const { 
    createPromotion, 
    getAllPromotions,
    getPromotion,
    deletePromotion,
    updatePromotion

} = require('../controllers/promotionController');

const router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 파일의 fieldname에 따라 저장 경로를 다르게 설정
        if (file.fieldname === 'promotionImage') {
            cb(null, 'uploads/promotion_images/'); // mainImage는 product_main_images 폴더에 저장
        }  else {
            cb(new Error('Invalid field name'), null); // 유효하지 않은 필드명이면 에러
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // 파일명에 타임스탬프 추가
    },
});


const upload = multer({ storage: storage }).fields([
    { name: 'promotionImage', maxCount: 1 },
]);
// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});

router.post('/promotion/create',upload, createPromotion);
router.get('/promotion/read', getAllPromotions);
router.get('/promotion/read/:id', getPromotion);
router.put('/promotion/:id', updatePromotion);
router.delete('/promotion/delete/:id', deletePromotion);

module.exports = router;

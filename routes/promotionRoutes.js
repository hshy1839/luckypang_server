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
const { v4: uuidv4 } = require('uuid'); // ✅ 이거 추가

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'promotionImage') {
      cb(null, 'uploads/promotion_images/');
    } else if (file.fieldname === 'promotionDetailImage') {
      cb(null, 'uploads/promotion_details/');
    } else {
      cb(new Error('Invalid field name'), null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage: storage }).fields([
    { name: 'promotionImage', maxCount: 1 },
    { name: 'promotionDetailImage', maxCount: 10 },
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

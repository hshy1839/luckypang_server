// routes/promotionRoutes.js
const express = require('express');
const {
  createPromotion,
  getAllPromotions,
  getPromotion,
  deletePromotion,
  updatePromotion,
} = require('../controllers/promotionController');

const router = express.Router();

// ✅ S3 업로드 미들웨어 사용
const { upload } = require('../middlewares/upload');

// (선택) 요청 로깅
router.use((req, res, next) => {
  // console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// 생성: 대표 이미지 1장, 상세 이미지 여러 장
router.post(
  '/promotion/create',
  upload.fields([
    { name: 'promotionImage', maxCount: 1 },
    { name: 'promotionDetailImage', maxCount: 10 },
  ]),
  createPromotion
);

// 전체/단건 조회
router.get('/promotion/read', getAllPromotions);
router.get('/promotion/read/:id', getPromotion);

// 수정: 이미지 교체/추가/유지 모두 지원하려면 파일 필드 허용해야 함
router.put(
  '/promotion/:id',
  upload.fields([
    { name: 'promotionImage', maxCount: 1 },
    { name: 'promotionDetailImage', maxCount: 10 },
  ]),
  updatePromotion
);

// 삭제
router.delete('/promotion/delete/:id', deletePromotion);

module.exports = router;

const express = require('express');
const { 
    createBox, 
    getAllBoxes, 
    deleteBox, 
    getBox, 
    updateBox,
} = require('../controllers/boxController');

const router = express.Router();
const multer = require('multer');
const path = require('path');

// multer 설정
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'mainImage') {
      cb(null, 'uploads/box_main_images/');
    } else if (file.fieldname === 'additionalImages') {
      cb(null, 'uploads/box_detail_images/');
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
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 20 }
]);

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});

// 상품 추가
router.post('/box', upload, createBox);
// 상품 목록 조회
router.get('/box',getAllBoxes);
// 상품 특정 조회
router.get('/box/:id', getBox);

// 상품 삭제
router.delete('/box/:id', deleteBox);
// 상품 수정
router.put('/box/:id', upload, updateBox);

module.exports = router;

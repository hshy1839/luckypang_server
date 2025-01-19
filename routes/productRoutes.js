const express = require('express');
const { 
    createProduct, 
    getAllProducts, 
    deleteProduct, 
    getProduct, 
    updateProduct,
    getProductsByCategory
} = require('../controllers/productController');

const router = express.Router();
const multer = require('multer');
const path = require('path');

// multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 파일의 fieldname에 따라 저장 경로를 다르게 설정
        if (file.fieldname === 'mainImage') {
            cb(null, 'uploads/product_main_images/'); // mainImage는 product_main_images 폴더에 저장
        } else if (file.fieldname === 'additionalImages') {
            cb(null, 'uploads/product_detail_images/'); // additionalImages는 product_detail_images 폴더에 저장
        } else {
            cb(new Error('Invalid field name'), null); // 유효하지 않은 필드명이면 에러
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // 파일명에 타임스탬프 추가
    },
});


const upload = multer({ storage: storage }).fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 10 }
]);

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// 상품 추가
router.post('/products/productCreate', upload, createProduct);
// 상품 목록 조회
router.get('/products/allProduct', getAllProducts);
// 상품 특정 조회
router.get('/products/Product/:id', getProduct);
//카테고리 별 상품 조회
router.get('/products/allProduct/category', (req, res, next) => {
    // 쿼리 파라미터에서 mainCategory와 subCategory 추출
    const { category } = req.query;

    // 디버깅용 로그 출력
    console.log(`[Category Query] Main: ${category || 'N/A'}, Sub: ${category || 'N/A'}`);

    // mainCategory 또는 subCategory가 하나라도 존재하는 경우만 진행
    if (!getProductsByCategory) {
        return res.status(400).json({
            success: false,
            message: '카테고리 정보를 제공해야 합니다. ',
        });
    }

    // 다음 미들웨어로 요청 전달
    next();
}, getProductsByCategory);

// 상품 삭제
router.delete('/products/delete/:id', deleteProduct);
// 상품 수정
router.put('/products/update/:id', updateProduct);

module.exports = router;

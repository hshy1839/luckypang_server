const jwt = require('jsonwebtoken');
const { Product } = require('../models/Product'); // Product 모델로 변경
const multer = require('multer');
const path = require('path');
const JWT_SECRET = 'jm_shoppingmall';
const fs = require('fs');
const mongoose = require("mongoose");


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


  // multer 설정
const upload = multer({ storage: storage });



exports.createProduct = async (req, res) => {
    try {
        // JWT 토큰 확인
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            return res.status(403).json({ success: false, message: 'Token is required' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }

        if (!decoded || !decoded.userId) {
            return res.status(401).json({ success: false, message: 'Token does not contain userId' });
        }

        // 파일 처리 후 저장된 경로 추출
        let mainImageUrl = '';
        if (req.files && req.files.mainImage) {
            mainImageUrl = '/uploads/' + req.files.mainImage[0].filename; // 로컬에 저장된 경로
        }

        const uploadedImages = [];
        if (req.files && req.files.additionalImages) {
            req.files.additionalImages.forEach(file => {
                uploadedImages.push('/uploads/' + file.filename); // 로컬에 저장된 경로들
            });
        }

        // 텍스트 데이터 받기
        const { name, categoryMain, categorySub, price, description, sizeStock } = req.body;

        // 제품 생성
        const product = new Product({
            name,
            category: { main: categoryMain, sub: categorySub },
            price,
            description,
            sizeStock,
            mainImage: mainImageUrl, 
            additionalImages: uploadedImages, 
        });

        console.log('Request Body:', req.body);
        console.log('Request Files:', req.files);

        const createdProduct = await product.save();

        return res.status(200).json({
            success: true,
            product: createdProduct,
        });
    } catch (err) {
        console.error('상품 등록 실패:', err);
        return res.status(500).json({
            success: false,
            message: '상품 등록 중 오류가 발생했습니다.',
            error: err.message,
        });
    }
};



// 모든 제품 조회
exports.getAllProducts = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        const products = await Product.find();
        if (!products || products.length === 0) {
            return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
        }

        res.status(200).json({
            success: true,
            totalProducts: products.length,
            products: products,
        });
    } catch (err) {
        console.error('모든 제품 조회 실패:', err);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 특정 제품 조회
exports.getProduct = async (req, res) => {
    const { id } = req.params;

    console.log('요청 ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.error('유효하지 않은 제품 ID:', id);
        return res.status(400).json({ success: false, message: '유효하지 않은 제품 ID입니다.' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.error('토큰 누락: 인증 실패');
            return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('디코딩된 토큰:', decoded);

        const product = await Product.findById(id);
        if (!product) {
            console.error('제품 없음:', id);
            return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
        }

        return res.status(200).json({ success: true, product });
    } catch (err) {
        console.error('제품 조회 중 오류:', err);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 제품 삭제
exports.deleteProduct = async (req, res) => {
    const { id } = req.params;

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
        }

        // 이미지 파일 삭제
        if (product.mainImage) {
            const mainImagePath = path.join(__dirname, '..', product.mainImage);
            await new Promise((resolve, reject) => {
                fs.unlink(mainImagePath, (err) => {
                    if (err) {
                        console.error('메인 이미지 삭제 실패:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }

        // 추가 이미지 삭제
        await Promise.all(
            product.additionalImages.map((image) => {
                const imagePath = path.join(__dirname, '..', image);
                return new Promise((resolve, reject) => {
                    fs.unlink(imagePath, (err) => {
                        if (err) {
                            console.error('추가 이미지 삭제 실패:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            })
        );

        // 제품 삭제
        await Product.findByIdAndDelete(id);

        return res.status(200).json({ success: true, message: '제품이 삭제되었습니다.' });
    } catch (err) {
        console.error('제품 삭제 중 오류 발생:', err);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 제품 수정
exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, description, price, category, sizeStock } = req.body;

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
        }

        product.name = name;
        product.description = description;
        product.price = price;

        // categoryMain과 categorySub를 분리하여 저장
        if (category && category.main && category.sub) {
            product.category.main = category.main;  // 상위 카테고리
            product.category.sub = category.sub;    // 하위 카테고리
        } else if (category && category.main) {
            product.category.main = category.main;  // 상위 카테고리만 있는 경우
            product.category.sub = '';             // 하위 카테고리 비워두기
        } else {
            return res.status(400).json({ success: false, message: '카테고리 정보가 부족합니다.' });
        }

        if (sizeStock) {
            product.sizeStock.S = sizeStock.S || 0;
            product.sizeStock.M = sizeStock.M || 0;
            product.sizeStock.L = sizeStock.L || 0;
            product.sizeStock.XL = sizeStock.XL || 0;
        }

        await product.save();

        return res.status(200).json({ success: true, message: '제품이 수정되었습니다.' });
    } catch (err) {
        console.error('제품 수정 중 오류 발생:', err);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};


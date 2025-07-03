const jwt = require('jsonwebtoken');
const { Product } = require('../models/Product'); // Product 모델로 변경
const multer = require('multer');
const path = require('path');
const JWT_SECRET = 'jm_shoppingmall';
const fs = require('fs');
const mongoose = require("mongoose");
const Box = require('../models/Box/Box.js');



const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'mainImage') {
      cb(null, 'uploads/product_main_images/');
    } else if (file.fieldname === 'additionalImages') {
      cb(null, 'uploads/product_detail_images/');
    } else {
      cb(new Error('Invalid field name'), null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});


  // multer 설정
  const upload = multer({
    storage: storage,
    limits: {
        files: 20, // ✅ 업로드할 수 있는 총 파일 개수 제한 (20개로 증가)
    },
}).fields([
    { name: 'mainImage', maxCount: 1 }, // ✅ 대표 이미지 1개
    { name: 'additionalImages', maxCount: 20 }, // ✅ 추가 이미지 20개
]);



// 상품 생성 (category 통합)
exports.createProduct = async (req, res) => {
    try {
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
  
      let mainImageUrl = '';
      if (req.files && req.files.mainImage) {
        mainImageUrl = '/uploads/product_main_images/' + req.files.mainImage[0].filename;
      }
  
      const uploadedImages = [];
      if (req.files && req.files.additionalImages) {
        req.files.additionalImages.forEach(file => {
          uploadedImages.push('/uploads/product_detail_images/' + file.filename);
        });
      }
  
      const {
        name,
        brand,
        category, // ✅ 박스 이름으로 전달됨
        probability,
        consumerPrice,
        price,
        shippingFee,
        shippingInfo,
        option,
        description,
        sourceLink,
        isSourceSoldOut,
        refundProbability
      } = req.body;
  
      const productNumber = 'P' + Date.now();
  
      const product = new Product({
        productNumber,
        name,
        brand,
        category,
        probability,
        consumerPrice,
        price,
        shippingFee,
        shippingInfo,
        option,
        description,
        sourceLink,
        isSourceSoldOut: isSourceSoldOut === 'true',
        mainImage: mainImageUrl,
        additionalImages: uploadedImages,
        refundProbability
      });
  
      const createdProduct = await product.save();
  
      // ✅ Box 모델에 해당 상품 추가
      if (category) {
        const box = await Box.findOne({ name: category });
        if (box) {
          const alreadyExists = box.products.some(p => p.product.toString() === createdProduct._id.toString());
          if (!alreadyExists) {
            box.products.push({
              product: createdProduct._id,
              probability: parseFloat(probability) || 0,
            });
            await box.save();
          }
        }
      }
  
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

exports.deleteProduct = async (req, res) => {
    const { id } = req.params;

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ success: false, message: "로그인 정보가 없습니다." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // 1️⃣ 제품 조회
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "제품을 찾을 수 없습니다." });
        }

        // 🔹 이미지 삭제 함수 (파일이 존재하면 삭제, 없으면 오류 무시)
        const deleteFile = async (filePath) => {
            try {
                const absolutePath = path.resolve(__dirname, "..", filePath.replace(/^\/+/, ""));
                if (fs.existsSync(absolutePath)) {
                    await fs.promises.unlink(absolutePath);
                    console.log(`✅ 파일 삭제 성공: ${absolutePath}`);
                } else {
                    console.warn(`⚠️ 파일이 존재하지 않음: ${absolutePath}`);
                }
            } catch (err) {
                console.error(`❌ 파일 삭제 중 오류 발생: ${filePath}`, err);
            }
        };

        // 2️⃣ 메인 이미지 삭제 (경로 확인 후 삭제)
        if (Array.isArray(product.mainImage)) {
            await Promise.all(
                product.mainImage.map(async (image) => {
                    if (typeof image === "string") {
                        console.log("🔹 삭제 시도: mainImage →", image);
                        await deleteFile(image);
                    }
                })
            );
        }

        // 3️⃣ 추가 이미지 삭제 (비동기 방식)
        if (Array.isArray(product.additionalImages)) {
            await Promise.all(
                product.additionalImages.map(async (image) => {
                    if (typeof image === "string") {
                        console.log("🔹 삭제 시도: additionalImage →", image);
                        await deleteFile(image);
                    }
                })
            );
        }

        // 4️⃣ 제품 데이터 삭제
        await Product.findByIdAndDelete(id);

        return res.status(200).json({ success: true, message: "제품이 삭제되었습니다." });
    } catch (err) {
        console.error("❌ 제품 삭제 중 오류 발생:", err);
        return res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
    }
};


// 제품 수정
exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const token = req.headers.authorization?.split(' ')[1];
    console.log(req.body);
    console.log(req.file);
    if (!token) {
      return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
    }
  
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const product = await Product.findById(id);
  
      if (!product) {
        return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
      }
  
      // 🔸 대표 이미지 처리
      if (req.files?.mainImage?.length > 0) {
        product.mainImage = '/uploads/product_main_images/' + req.files.mainImage[0].filename;
      } else if (req.body.retainMainImage === 'true') {
        // 유지
      } else {
        product.mainImage = '';
      }
  
      // 🔸 상세 이미지 처리
      if (req.files?.additionalImages?.length > 0) {
        const newImages = req.files.additionalImages.map(file =>
          '/uploads/product_detail_images/' + file.filename
        );
      
        // 기존 이미지 유지 요청이 있는 경우 병합
        const retained = req.body.initialAdditionalImages;
        const retainedArray = retained
          ? Array.isArray(retained) ? retained : [retained]
          : [];
      
        product.additionalImages = [...retainedArray, ...newImages];
      } else if (req.body.retainAdditionalImages === 'true') {
        const retained = req.body.initialAdditionalImages;
        product.additionalImages = Array.isArray(retained) ? retained : [retained];
      } else {
        product.additionalImages = [];
      }
  
      // 🔸 일반 텍스트 필드 업데이트
      const fields = [
        'name', 'brand', 'category', 'probability',
        'consumerPrice', 'price', 'shippingFee',
        'shippingInfo', 'option', 'description', 'sourceLink','refundProbability'
      ];
  
      fields.forEach(field => {
        if (field in req.body) product[field] = req.body[field];
      });
  
      product.isSourceSoldOut = req.body.isSourceSoldOut === 'true';
  
      await product.save();
  
     await Box.updateMany(
      { "products.product": product._id },
      { $set: { "products.$[elem].probability": product.probability } },
      { arrayFilters: [{ "elem.product": product._id }] }
    );
    console.log(`[LOG] 상품ID(${product._id})가 포함된 모든 박스의 확률을 ${product.probability}로 동기화`);

    return res.status(200).json({ success: true, product });
  
      
    } catch (err) {
      console.error('제품 수정 중 오류 발생:', err);
      return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  };
  
  
  
  
  


// 특정 카테고리의 제품 조회 (단일 category 필드 기준)
exports.getProductsByCategory = async (req, res) => {
    const { category } = req.query;
  
    try {
        const products = await Product.find({ category }).sort({ createdAt: -1 });;

        if (!products || products.length === 0) {
            return res.status(404).json({ success: false, message: '해당 카테고리의 제품이 없습니다.' });
        }

        res.status(200).json({
            success: true,
            totalProducts: products.length,
            products,
        });
    } catch (err) {
        console.error('카테고리로 제품 조회 중 오류 발생:', err);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};
exports.getProductsSearch = async (req, res) => {
    const { name, category } = req.query;
  
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
      }
  
      let query = {};
      if (name) {
        query.name = { $regex: name, $options: 'i' };
      } else if (category) {
        query.category = { $regex: category, $options: 'i' };
      }
  
      const products = await Product.find(query).select('name _id probability category');
  
      res.json({ success: true, products });
    } catch (err) {
      res.status(500).json({ success: false, message: '검색 실패', error: err });
    }
  };
  
  

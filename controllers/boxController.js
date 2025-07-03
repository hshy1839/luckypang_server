const jwt = require('jsonwebtoken');
const Box = require('../models/Box/Box.js');
const multer = require('multer');
const path = require('path');
const JWT_SECRET = 'jm_shoppingmall';
const fs = require('fs');
const mongoose = require("mongoose");
const { Product } = require('../models/Product'); 


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
exports.createBox = async (req, res) => {
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
  
      if (!decoded?.userId) {
        return res.status(401).json({ success: false, message: 'Token does not contain userId' });
      }
  
      // ✅ 이미지 처리
      let mainImageUrl = '';
      if (req.files?.mainImage?.[0]) {
        mainImageUrl = '/uploads/box_main_images/' + req.files.mainImage[0].filename;
      }
  
      const uploadedImages = req.files?.additionalImages?.map(file => (
        '/uploads/box_detail_images/' + file.filename
      )) || [];
  
      // ✅ 텍스트 데이터
      const {
        name,
        description,
        price,
        isPublic,
        type,
        availableFrom,
        availableUntil,
        purchaseLimit,
      } = req.body;
  
      // ✅ products 파싱
      let parsedProducts = [];
      const rawProducts = req.body.products;
  
      if (Array.isArray(rawProducts)) {
        parsedProducts = rawProducts
          .map((p) => {
            try {
              return JSON.parse(p);
            } catch (e) {
              console.error('Invalid JSON in products[]:', p);
              return null;
            }
          })
          .filter(Boolean);
      } else if (typeof rawProducts === 'string') {
        try {
          parsedProducts = [JSON.parse(rawProducts)];
        } catch (e) {
          console.error('Invalid single product JSON:', rawProducts);
          return res.status(400).json({ success: false, message: 'Invalid product format' });
        }
      }
  
      // ✅ Box 생성
      const box = new Box({
        name,
        description,
        price,
        type,
        availableFrom,
        availableUntil,
        purchaseLimit,
        isPublic: isPublic === 'true',
        products: parsedProducts,
        mainImage: mainImageUrl,
        additionalImages: uploadedImages,
      });
  
      const createdBox = await box.save();
  
      // ✅ 포함된 상품들의 category를 박스 이름으로 설정
      if (parsedProducts.length > 0) {
        await Promise.all(
          parsedProducts.map(async (item) => {
            await Product.findByIdAndUpdate(item.product, {
              category: createdBox.name,
            });
          })
        );
      }
  
      return res.status(200).json({
        success: true,
        box: createdBox,
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
exports.getAllBoxes = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        const boxes = await Box.find();
        if (!boxes || boxes.length === 0) {
            return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
        }

        res.status(200).json({
            success: true,
            totalBoxes: boxes.length,
            boxes: boxes,
        });
    } catch (err) {
        console.error('모든 제품 조회 실패:', err);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 특정 제품 조회
exports.getBox = async (req, res) => {
    const { id } = req.params;


    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.error('유효하지 않은 박스 ID:', id);
        return res.status(400).json({ success: false, message: '유효하지 않은 박스 ID입니다.' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.error('토큰 누락: 인증 실패');
            return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        const box = await Box.findById(id).populate({
            path: 'products.product',
            model: 'Product',
          });
          
        if (!box) {
            console.error('제품 없음:', id);
            return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
        }

    

        return res.status(200).json({ success: true, box });

    } catch (err) {
        console.error('제품 조회 중 오류:', err);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

exports.deleteBox = async (req, res) => {
    const { id } = req.params;

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ success: false, message: "로그인 정보가 없습니다." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // 1️⃣ 제품 조회
        const box = await Box.findById(id);
        if (!box) {
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
        if (Array.isArray(box.mainImage)) {
            await Promise.all(
                box.mainImage.map(async (image) => {
                    if (typeof image === "string") {
                        console.log("🔹 삭제 시도: mainImage →", image);
                        await deleteFile(image);
                    }
                })
            );
        }

        // 3️⃣ 추가 이미지 삭제 (비동기 방식)
        if (Array.isArray(box.additionalImages)) {
            await Promise.all(
                box.additionalImages.map(async (image) => {
                    if (typeof image === "string") {
                        console.log("🔹 삭제 시도: additionalImage →", image);
                        await deleteFile(image);
                    }
                })
            );
        }

        // 4️⃣ 제품 데이터 삭제
        await Box.findByIdAndDelete(id);

        return res.status(200).json({ success: true, message: "박스가 삭제되었습니다." });
    } catch (err) {
        console.error("❌ 박스 삭제 중 오류 발생:", err);
        return res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
    }
};


// 제품 수정
exports.updateBox = async (req, res) => {
    const { id } = req.params;
    const token = req.headers.authorization?.split(' ')[1];
    console.log(req.body);
    console.log(req.file);
    if (!token) {
      return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
    }
  
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const box = await Box.findById(id);
  
      if (!box) {
        return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
      }
  
      // 🔸 대표 이미지 처리
      if (req.files?.mainImage?.length > 0) {
        box.mainImage = '/uploads/box_main_images/' + req.files.mainImage[0].filename;
      } else if (req.body.retainMainImage === 'true') {
        // 유지
      } else {
        box.mainImage = '';
      }
  
      // 🔸 상세 이미지 처리
      if (req.files?.additionalImages?.length > 0) {
        const newImages = req.files.additionalImages.map(file =>
          '/uploads/box_detail_images/' + file.filename
        );
      
        // 기존 이미지 유지 요청이 있는 경우 병합
        const retained = req.body.initialAdditionalImages;
        const retainedArray = retained
          ? Array.isArray(retained) ? retained : [retained]
          : [];
      
          box.additionalImages = [...retainedArray, ...newImages];
      } else if (req.body.retainAdditionalImages === 'true') {
        const retained = req.body.initialAdditionalImages;
        box.additionalImages = Array.isArray(retained) ? retained : [retained];
      } else {
        box.additionalImages = [];
      }
  
      // 🔸 일반 텍스트 필드 업데이트
      const fields = [
        'name', 'description', 'price', 'isPublic',
        'type', 'availableFrom', 'availableUntil',
        'purchaseLimit', 'products'
      ];
      fields.forEach(field => {
        if (field in req.body && req.body[field]) {
          if (field === 'availableFrom' || field === 'availableUntil') {
            box[field] = new Date(req.body[field]);  // 🔸 명시적 형변환
          } else if (field === 'isPublic') {
            box[field] = req.body[field] === 'true';
          } else {
            box[field] = req.body[field];
          }
        }
      });
  
      box.isPublic = req.body.isPublic === 'true';
  
      await box.save();
  
      return res.status(200).json({ success: true, box });
  
    } catch (err) {
      console.error('제품 수정 중 오류 발생:', err);
      return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  };
  
  
  
  


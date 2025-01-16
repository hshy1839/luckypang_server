const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Promotion } = require('../models/Promotion'); // Promotion 모델 import
const JWT_SECRET = 'jm_shoppingmall';

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'promotionImage') {
      cb(null, 'uploads/promotion_images/'); // promotionImage는 promotion_images 폴더에 저장
    } else {
      cb(new Error('Invalid field name'), null); // 유효하지 않은 필드명이면 에러
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // 파일명에 타임스탬프 추가
  },
});

const upload = multer({ storage: storage });

// 프로모션 생성
exports.createPromotion = async (req, res) => {
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
  
      // 파일 처리 후 저장된 경로 추출
      const promotionImages = [];
      if (req.files && req.files.promotionImage) {
        req.files.promotionImage.forEach(file => {
          promotionImages.push('/uploads/promotion_images/' + file.filename); // 로컬에 저장된 경로
        });
      }
  
      const { name } = req.body; // 텍스트 데이터 받기
  
      if (!name) {
        return res.status(400).json({ success: false, message: 'Name is required' });
      }
  
      // 프로모션 생성
      const promotion = new Promotion({
        name,
        promotionImage: promotionImages,
      });
  
      const createdPromotion = await promotion.save();
  
      return res.status(200).json({
        success: true,
        promotion: createdPromotion,
      });
    } catch (err) {
      console.error('프로모션 등록 실패:', err);
      return res.status(500).json({
        success: false,
        message: '프로모션 등록 중 오류가 발생했습니다.',
        error: err.message,
      });
    }
  };
  

// 모든 프로모션 조회
exports.getAllPromotions = async (req, res) => {
  try {
    const promotions = await Promotion.find();
    if (!promotions || promotions.length === 0) {
      return res.status(404).json({ success: false, message: '프로모션을 찾을 수 없습니다.' });
    }

    res.status(200).json({
      success: true,
      totalPromotions: promotions.length,
      promotions: promotions,
    });
  } catch (err) {
    console.error('모든 프로모션 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 특정 프로모션 조회
exports.getPromotion = async (req, res) => {
  const { id } = req.params;

  try {
    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return res.status(404).json({ success: false, message: '프로모션을 찾을 수 없습니다.' });
    }

    return res.status(200).json({ success: true, promotion });
  } catch (err) {
    console.error('프로모션 조회 중 오류 발생:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 프로모션 삭제
exports.deletePromotion = async (req, res) => {
    const { id } = req.params;

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const promotion = await Promotion.findById(id);
        if (!promotion) {
            return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });
        }

    
        if (Array.isArray(promotion.promotionImage)) {
            await Promise.all(
                promotion.promotionImage.map((image) => {
                    if (typeof image === 'string') {
                        const imagePath = path.join(__dirname, '..', image);
                        return new Promise((resolve, reject) => {
                            fs.unlink(imagePath, (err) => {
                                if (err) {
                                    console.error('메인 이미지 삭제 실패:', err);
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    } else {
                        console.warn('올바르지 않은 이미지 경로:', image);
                        return Promise.resolve();
                    }
                })
            );
        }
        

        // 제품 삭제
        await Promotion.findByIdAndDelete(id);

        return res.status(200).json({ success: true, message: '제품이 삭제되었습니다.' });
    } catch (err) {
        console.error('제품 삭제 중 오류 발생:', err);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};
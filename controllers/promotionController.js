const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Promotion } = require('../models/Promotion');
const JWT_SECRET = 'jm_shoppingmall';

// Multer 설정
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
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });
exports.uploadPromotion = upload.fields([
  { name: 'promotionImage' },
  { name: 'promotionDetailImage' },
]);

// 프로모션 생성
exports.createPromotion = async (req, res) => {
  try {

    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ success: false, message: 'Token is required' });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.userId) return res.status(401).json({ success: false, message: 'Invalid token' });



    const promotionImages = (req.files.promotionImage || []).map(file => '/uploads/promotion_images/' + file.filename);
    const promotionDetails = (req.files.promotionDetailImage || []).map(file => '/uploads/promotion_details/' + file.filename);

    const { name, title, content } = req.body;
    if (!name || !title || !promotionImages.length || !promotionDetails.length) {
      return res.status(400).json({ success: false, message: '필수 항목이 누락되었습니다.' });
    }

    const promotion = new Promotion({
      name,
      title,
      content,
      promotionImage: promotionImages,
      promotionDetailImage: promotionDetails,
    });

    const created = await promotion.save();
    return res.status(200).json({ success: true, promotion: created });
  } catch (err) {
    console.error('프로모션 등록 실패:', err);
    return res.status(500).json({ success: false, message: '프로모션 등록 중 오류가 발생했습니다.', error: err.message });
  }
};

// 모든 프로모션 조회
exports.getAllPromotions = async (req, res) => {
  try {
    const promotions = await Promotion.find();
    res.status(200).json({ success: true, totalPromotions: promotions.length, promotions });
  } catch (err) {
    console.error('모든 프로모션 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 특정 프로모션 조회
exports.getPromotion = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) return res.status(404).json({ success: false, message: '프로모션을 찾을 수 없습니다.' });
    res.status(200).json({ success: true, promotion });
  } catch (err) {
    console.error('프로모션 조회 중 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 프로모션 삭제
exports.deletePromotion = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) return res.status(404).json({ success: false, message: '프로모션을 찾을 수 없습니다.' });

    const deleteFiles = [...promotion.promotionImage, ...promotion.promotionDetailImage];
    await Promise.all(deleteFiles.map((image) => {
      const imagePath = path.join(__dirname, '..', image);
      return fs.promises.unlink(imagePath).catch(err => console.warn('파일 삭제 실패:', err));
    }));

    await Promotion.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: '프로모션이 삭제되었습니다.' });
  } catch (err) {
    console.error('삭제 중 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 프로모션 수정
exports.updatePromotion = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { name, title, content } = req.body;
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) return res.status(404).json({ success: false, message: '프로모션을 찾을 수 없습니다.' });

    promotion.name = name || promotion.name;
    promotion.title = title || promotion.title;
    promotion.content = content || promotion.content;

    await promotion.save();
    res.status(200).json({ success: true, message: '프로모션이 수정되었습니다.', promotion });
  } catch (err) {
    console.error('수정 중 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

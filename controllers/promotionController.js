// controllers/promotionController.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Promotion } = require('../models/Promotion');
const { s3 } = require('../aws/s3');
const { GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const JWT_SECRET = 'jm_shoppingmall';
const S3_BUCKET = process.env.S3_BUCKET;

// ───────── 공통 유틸 ─────────
async function presign(key, ttl = 600) {
  if (!key) return '';
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: ttl }); // 초 단위
}

async function deleteS3Key(key) {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    console.log(`✅ S3 삭제 성공: s3://${S3_BUCKET}/${key}`);
  } catch (e) {
    console.warn(`⚠️ S3 삭제 경고: ${key} (${e?.name || e?.code || e?.message})`);
  }
}

async function attachSignedUrls(doc, ttl = 600) {
  const p = doc.toObject ? doc.toObject() : doc;

  const imgKeys = Array.isArray(p.promotionImage) ? p.promotionImage : (p.promotionImage ? [p.promotionImage] : []);
  const detailKeys = Array.isArray(p.promotionDetailImage) ? p.promotionDetailImage : (p.promotionDetailImage ? [p.promotionDetailImage] : []);

  p.promotionImageUrls = await Promise.all(imgKeys.map(k => presign(k, ttl)));
  p.promotionDetailImageUrls = await Promise.all(detailKeys.map(k => presign(k, ttl)));

  return p;
}

// ─────────────────────────────────────────────────────
// 프로모션 생성 (multer-s3: req.files.*[].key 사용)
//  - 필수: name, title, promotionImage(1+), promotionDetailImage(1+)
// ─────────────────────────────────────────────────────
exports.createPromotion = async (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ success: false, message: 'Token is required' });

    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: 'Invalid or expired token' }); }
    if (!decoded?.userId) return res.status(401).json({ success: false, message: 'Invalid token' });

    // S3 key 수집
    const promotionImages = (req.files?.promotionImage || []).map(f => f.key);
    const promotionDetails = (req.files?.promotionDetailImage || []).map(f => f.key);

    const { name, title, content } = req.body;
    if (!name || !title || promotionImages.length === 0 || promotionDetails.length === 0) {
      return res.status(400).json({ success: false, message: '필수 항목이 누락되었습니다.' });
    }

    const promotion = new Promotion({
      name,
      title,
      content,
      // DB에는 S3 key만 저장
      promotionImage: promotionImages,
      promotionDetailImage: promotionDetails,
    });

    const created = await promotion.save();
    const withUrls = await attachSignedUrls(created, 600); // 10분

    return res.status(201).json({ success: true, promotion: withUrls });
  } catch (err) {
    console.error('프로모션 등록 실패:', err);
    return res.status(500).json({ success: false, message: '프로모션 등록 중 오류가 발생했습니다.', error: err.message });
  }
};

// ─────────────────────────────────────────────────────
// 모든 프로모션 조회 (프리사인 URL 포함)
// ─────────────────────────────────────────────────────
exports.getAllPromotions = async (req, res) => {
  try {
    const promotions = await Promotion.find().sort({ createdAt: -1 });
    const withUrls = await Promise.all(promotions.map(p => attachSignedUrls(p, 300))); // 5분
    res.status(200).json({ success: true, totalPromotions: withUrls.length, promotions: withUrls });
  } catch (err) {
    console.error('모든 프로모션 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// ─────────────────────────────────────────────────────
// 특정 프로모션 조회 (프리사인 URL 포함)
// ─────────────────────────────────────────────────────
exports.getPromotion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 ID' });
    }

    const promotion = await Promotion.findById(id);
    if (!promotion) return res.status(404).json({ success: false, message: '프로모션을 찾을 수 없습니다.' });

    const withUrls = await attachSignedUrls(promotion, 600);
    res.status(200).json({ success: true, promotion: withUrls });
  } catch (err) {
    console.error('프로모션 조회 중 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// ─────────────────────────────────────────────────────
// 프로모션 삭제 (S3 객체도 삭제)
// ─────────────────────────────────────────────────────
exports.deletePromotion = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(403).json({ success: false, message: 'Token is required' });

    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: 'Invalid or expired token' }); }
    if (!decoded?.userId) return res.status(401).json({ success: false, message: 'Invalid token' });

    const { id } = req.params;
    const promotion = await Promotion.findById(id);
    if (!promotion) return res.status(404).json({ success: false, message: '프로모션을 찾을 수 없습니다.' });

    const deleteKeys = [
      ...(Array.isArray(promotion.promotionImage) ? promotion.promotionImage : (promotion.promotionImage ? [promotion.promotionImage] : [])),
      ...(Array.isArray(promotion.promotionDetailImage) ? promotion.promotionDetailImage : (promotion.promotionDetailImage ? [promotion.promotionDetailImage] : [])),
    ];
    await Promise.all(deleteKeys.map(k => deleteS3Key(k)));

    await Promotion.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: '프로모션이 삭제되었습니다.' });
  } catch (err) {
    console.error('삭제 중 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// ─────────────────────────────────────────────────────
// 프로모션 수정
//  - 파일 교체/추가/유지 전략
//  - 요청 바디 파라미터:
//      * retainPromotionImage: 'true'|'false' (업로드가 없을 때 유지/초기화)
//      * initialPromotionImages: 유지할 기존 key 배열(문자열 또는 배열)
//      * retainPromotionDetailImage: 'true'|'false'
//      * initialPromotionDetailImages: 유지할 기존 key 배열
// ─────────────────────────────────────────────────────
exports.updatePromotion = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(403).json({ success: false, message: 'Token is required' });

    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: 'Invalid or expired token' }); }
    if (!decoded?.userId) return res.status(401).json({ success: false, message: 'Invalid token' });

    const { id } = req.params;
    const promotion = await Promotion.findById(id);
    if (!promotion) return res.status(404).json({ success: false, message: '프로모션을 찾을 수 없습니다.' });

    const {
      name, title, content,
      retainPromotionImage, retainPromotionDetailImage,
      initialPromotionImages, initialPromotionDetailImages,
    } = req.body;

    // 업로드된 신규 키
    const uploadedMain = (req.files?.promotionImage || []).map(f => f.key);
    const uploadedDetails = (req.files?.promotionDetailImage || []).map(f => f.key);

    // 1) 대표 이미지 처리
    if (uploadedMain.length > 0) {
      const retained = initialPromotionImages
        ? (Array.isArray(initialPromotionImages) ? initialPromotionImages : [initialPromotionImages])
        : [];

      const old = Array.isArray(promotion.promotionImage) ? promotion.promotionImage : [];
      const toDelete = old.filter(k => !retained.includes(String(k)));
      await Promise.all(toDelete.map(k => deleteS3Key(k)));

      promotion.promotionImage = [...retained, ...uploadedMain];
    } else if (retainPromotionImage === 'true') {
      // 유지
    } else if (retainPromotionImage === 'false') {
      const old = Array.isArray(promotion.promotionImage) ? promotion.promotionImage : [];
      await Promise.all(old.map(k => deleteS3Key(k)));
      promotion.promotionImage = [];
    }

    // 2) 상세 이미지 처리
    if (uploadedDetails.length > 0) {
      const retained = initialPromotionDetailImages
        ? (Array.isArray(initialPromotionDetailImages) ? initialPromotionDetailImages : [initialPromotionDetailImages])
        : [];

      const old = Array.isArray(promotion.promotionDetailImage) ? promotion.promotionDetailImage : [];
      const toDelete = old.filter(k => !retained.includes(String(k)));
      await Promise.all(toDelete.map(k => deleteS3Key(k)));

      promotion.promotionDetailImage = [...retained, ...uploadedDetails];
    } else if (retainPromotionDetailImage === 'true') {
      // 유지
    } else if (retainPromotionDetailImage === 'false') {
      const old = Array.isArray(promotion.promotionDetailImage) ? promotion.promotionDetailImage : [];
      await Promise.all(old.map(k => deleteS3Key(k)));
      promotion.promotionDetailImage = [];
    }

    // 3) 텍스트 필드
    if (name !== undefined) promotion.name = name;
    if (title !== undefined) promotion.title = title;
    if (content !== undefined) promotion.content = content;

    const saved = await promotion.save();
    const withUrls = await attachSignedUrls(saved, 600);

    res.status(200).json({ success: true, message: '프로모션이 수정되었습니다.', promotion: withUrls });
  } catch (err) {
    console.error('수정 중 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

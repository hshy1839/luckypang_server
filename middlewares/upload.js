// middlewares/upload.js
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { s3 } = require('../aws/s3'); // 앞에서 만든 s3.js

const bucket = process.env.S3_BUCKET;

// 파일명 규칙 (버킷 안 key)
function makeKey(dir, file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${dir}/${ts}_${rand}_${base}${ext}`;
}

// 필드명 → 디렉토리 구분
function dirByField(field) {
  if (field === 'mainImage') return 'product_main_images';
  if (field === 'additionalImages') return 'product_detail_images';
  if (field === 'noticeImage') return 'notice_images';  
  if (field === 'promotionImage') return 'promotion_images';        
  if (field === 'promotionDetailImage') return 'promotion_details';  
  return 'others';
}

const upload = multer({
  storage: multerS3({
    s3,
    bucket,
    acl: 'private', // 프리사인 URL로 접근할 거라면 private
    contentType: multerS3.AUTO_CONTENT_TYPE,
    cacheControl: 'max-age=31536000, public',
    key: (req, file, cb) => {
      const dir = dirByField(file.fieldname);
      const key = makeKey(dir, file);
      console.log(`📤 업로드 → ${bucket}/${key}`);
      cb(null, key);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 제한
});

module.exports = { upload };

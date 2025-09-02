// controllers/noticeController.js
const jwt = require('jsonwebtoken');
const path = require('path');
const mongoose = require('mongoose');
const { Notice } = require('../models/Notice'); // 모델 import 방식 유지
const { s3 } = require('../aws/s3');
const { GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const JWT_SECRET = 'jm_shoppingmall';
const S3_BUCKET = process.env.S3_BUCKET;

// ---- 공통 유틸 ----
async function presign(key, ttl = 600) {
  if (!key) return '';
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: ttl });
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
  const n = doc.toObject ? doc.toObject() : doc;
  const imgs = Array.isArray(n.noticeImage) ? n.noticeImage : (n.noticeImage ? [n.noticeImage] : []);
  n.noticeImageUrls = await Promise.all(imgs.map(k => presign(k, ttl)));
  return n;
}

// ─────────────────────────────────────────────────────
// 공지 생성 (multer-s3: req.files.noticeImage[].key 저장)
// ─────────────────────────────────────────────────────
exports.createNotice = async (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ success: false, message: 'Token is required' });

    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: 'Invalid or expired token' }); }
    if (!decoded?.userId) return res.status(401).json({ success: false, message: 'Token does not contain userId' });

    // S3 key 수집
    const noticeImageKeys = (req.files?.noticeImage || []).map(f => f.key);

    const { title, content, isVisible } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const notice = new Notice({
      title,
      content,
      isVisible: isVisible === 'true' || isVisible === true,
      // DB에는 S3 key만 저장
      noticeImage: noticeImageKeys,
    });

    const created = await notice.save();
    const withUrls = await attachSignedUrls(created, 600);

    return res.status(201).json({ success: true, notice: withUrls });
  } catch (err) {
    console.error('공지사항 등록 실패:', err);
    return res.status(500).json({
      success: false,
      message: '공지사항 등록 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

// ─────────────────────────────────────────────────────
// 공지 전체 조회 (프리사인 URL 포함)
// ─────────────────────────────────────────────────────
exports.getAllNotices = async (req, res) => {
  try {
    const notices = await Notice.find().sort({ createdAt: -1 });
    const withUrls = await Promise.all(notices.map(n => attachSignedUrls(n, 300))); // 5분
    return res.status(200).json({ success: true, total: withUrls.length, notices: withUrls });
  } catch (err) {
    console.error('📛 공지사항 목록 불러오기 실패:', err);
    return res.status(500).json({
      success: false,
      message: '공지사항 목록 조회 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

// ─────────────────────────────────────────────────────
// 공지 단건 조회 (프리사인 URL 포함)
// ─────────────────────────────────────────────────────
exports.getNoticeById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 ID' });
    }

    const notice = await Notice.findById(id);
    if (!notice) return res.status(404).json({ success: false, message: '해당 공지사항을 찾을 수 없습니다.' });

    const withUrl = await attachSignedUrls(notice, 600);
    return res.status(200).json({ success: true, notice: withUrl });
  } catch (err) {
    console.error('📛 공지사항 조회 실패:', err);
    return res.status(500).json({
      success: false,
      message: '공지사항 조회 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

// ─────────────────────────────────────────────────────
// 공지 수정 (이미지 교체/유지/초기화 지원)
// - 새 noticeImage 업로드가 있으면 기본적으로 기존 것을 삭제 후 교체
// - retainNoticeImage === 'true' 이면 기존 유지(업로드 없을 때)
// - retainNoticeImage === 'false' 이면 기존 전부 삭제
// - initialNoticeImages 배열이 넘어오면, 그 키들만 유지 + 새로 업로드한 키들과 병합
// ─────────────────────────────────────────────────────
exports.updateNotice = async (req, res) => {
  try {
    const id = req.params.id;
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ success: false, message: 'Token is required' });

    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: 'Invalid or expired token' }); }
    if (!decoded?.userId) return res.status(401).json({ success: false, message: 'Token does not contain userId' });

    const notice = await Notice.findById(id);
    if (!notice) return res.status(404).json({ success: false, message: '해당 공지사항을 찾을 수 없습니다.' });

    const { title, content, isVisible, retainNoticeImage, initialNoticeImages } = req.body;
    const uploadedKeys = (req.files?.noticeImage || []).map(f => f.key);

    // 이미지 처리
    if (uploadedKeys.length > 0) {
      // initialNoticeImages를 보냈다면: 명시적으로 유지할 기존 키만 남기고 나머지는 삭제
      const retained = initialNoticeImages
        ? (Array.isArray(initialNoticeImages) ? initialNoticeImages : [initialNoticeImages])
        : [];

      const oldKeys = Array.isArray(notice.noticeImage) ? notice.noticeImage : [];
      const toDelete = oldKeys.filter(k => !retained.includes(String(k)));

      await Promise.all(toDelete.map(k => deleteS3Key(k)));
      notice.noticeImage = [...retained, ...uploadedKeys];
    } else if (retainNoticeImage === 'true') {
      // 아무 것도 안 함 (기존 유지)
    } else if (retainNoticeImage === 'false') {
      // 기존 전부 삭제 후 비우기
      const oldKeys = Array.isArray(notice.noticeImage) ? notice.noticeImage : [];
      await Promise.all(oldKeys.map(k => deleteS3Key(k)));
      notice.noticeImage = [];
    } // 그 외: 업로드/retain 파라미터 없으면 그대로 둠

    // 텍스트 필드 업데이트
    if (title !== undefined) notice.title = title;
    if (content !== undefined) notice.content = content;
    if (isVisible !== undefined) notice.isVisible = (isVisible === 'true' || isVisible === true);

    const updated = await notice.save();
    const withUrls = await attachSignedUrls(updated, 600);

    return res.status(200).json({ success: true, notice: withUrls });
  } catch (err) {
    console.error('📛 공지사항 수정 실패:', err);
    return res.status(500).json({
      success: false,
      message: '공지사항 수정 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

// ─────────────────────────────────────────────────────
// 공지 삭제 (S3 객체도 삭제)
// ─────────────────────────────────────────────────────
exports.deleteNotice = async (req, res) => {
  try {
    const id = req.params.id;
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ success: false, message: 'Token is required' });

    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: 'Invalid or expired token' }); }
    if (!decoded?.userId) return res.status(401).json({ success: false, message: 'Token does not contain userId' });

    const notice = await Notice.findById(id);
    if (!notice) return res.status(404).json({ success: false, message: '해당 공지사항을 찾을 수 없습니다.' });

    const keys = Array.isArray(notice.noticeImage) ? notice.noticeImage : (notice.noticeImage ? [notice.noticeImage] : []);
    await Promise.all(keys.map(k => deleteS3Key(k)));

    await Notice.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: '공지사항이 삭제되었습니다.' });
  } catch (err) {
    console.error('📛 공지사항 삭제 실패:', err);
    return res.status(500).json({
      success: false,
      message: '공지사항 삭제 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

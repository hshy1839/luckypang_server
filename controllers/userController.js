// controllers/userController.js
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const mongoose = require("mongoose");
const axios = require('axios');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const iconv = require('iconv-lite');
const qs = require('querystring');
const Bootpay = require('@bootpay/backend-js').default;
const requestIp = require('request-ip');

const { User } = require('../models/User');
const Order = require('../models/Order');
const { qnaAnswer } = require('../models/QnaAnswer');
const { qnaQuestion } = require('../models/QnaQuestion');
const Shipping = require('../models/Shipping');
const ShippingOrder = require('../models/ShippingOrder');
const Notification = require('../models/Notification');
const Point = require('../models/Point');

const JWT_SECRET = 'jm_shoppingmall';

// ==== S3 관련 ====
const { s3 } = require('../aws/s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const S3_BUCKET = process.env.S3_BUCKET;

// ─────────────────────────────────────────────────────
// S3 유틸
// ─────────────────────────────────────────────────────
async function presign(key, ttl = 600) {
  if (!key) return '';
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: ttl });
}

async function deleteS3Key(key) {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    console.log(`✅ S3 삭제: s3://${S3_BUCKET}/${key}`);
  } catch (e) {
    console.warn(`⚠️ S3 삭제 경고: ${key} (${e?.name || e?.code || e?.message})`);
  }
}

async function attachUserSignedUrl(userDoc, ttl = 600) {
  const u = userDoc.toObject ? userDoc.toObject() : userDoc;
  u.profileImageUrl = u.profileImage ? await presign(u.profileImage, ttl) : '';
  return u;
}

// ─────────────────────────────────────────────────────
// 랜덤/추천코드 & 닉네임 검증
// ─────────────────────────────────────────────────────
const generateRandomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};
const generateUniqueReferralCode = async () => {
  let code;
  while (true) {
    code = generateRandomCode();
    const exists = await User.exists({ referralCode: code });
    if (!exists) break;
  }
  return code;
};
const calculateTotalPoint = async (userId) => {
  const points = await Point.find({ user: userId });
  return points.reduce((acc, p) => {
    if (p.type === '추가' || p.type === '환불') return acc + p.amount;
    if (p.type === '감소') return acc - p.amount;
    return acc;
  }, 0);
};

let blacklistSet = new Set();
const BL_PATH = path.join(__dirname, '..', 'blacklist.txt');
function escapeRegex(s = '') { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function normalize(s = '') {
  let out = String(s).toLowerCase();
  out = out.replace(/ㅣ/g, 'l')
    .replaceAll('0','o').replaceAll('1','l').replaceAll('3','e')
    .replaceAll('4','a').replaceAll('5','s').replaceAll('7','t').replaceAll('8','b')
    .replace(/\s+/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ]/g, '');
  return out;
}
function loadBlacklist() {
  try {
    let raw = fs.readFileSync(BL_PATH, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    blacklistSet = new Set(raw.split(/\r?\n/).map(w => normalize(w)).filter(Boolean));
  } catch { blacklistSet = new Set(); }
}
try { fs.watch(BL_PATH, { persistent: false }, () => loadBlacklist()); } catch {}
loadBlacklist();
function isBlacklisted(nickname) {
  const norm = normalize(nickname);
  for (const bad of blacklistSet) if (bad && norm.includes(bad)) return true;
  return false;
}
async function validateNickname(nickname, { excludeUserId = null } = {}) {
  const trimmed = String(nickname || '').trim();
  const reasons = [];
  if (trimmed.length < 2 || trimmed.length > 8) reasons.push('length');
  if (isBlacklisted(trimmed)) reasons.push('blacklist');
  const regex = new RegExp(`^${escapeRegex(trimmed)}$`, 'i');
  const dupQuery = excludeUserId ? { _id: { $ne: excludeUserId }, nickname: regex } : { nickname: regex };
  let exists = false; try { exists = await User.exists(dupQuery); } catch {}
  if (exists) reasons.push('duplicate');
  const ok = reasons.length === 0;
  const message = ok
    ? '사용 가능한 닉네임 입니다.'
    : (reasons.includes('blacklist') ? '사용할 수 없는 닉네임 입니다.'
      : reasons.includes('duplicate') ? '이미 사용 중인 닉네임입니다.'
      : '닉네임은 2~8자입니다.');
  return { ok, reasons, message, exists: !!exists };
}

// ─────────────────────────────────────────────────────
// 공통
// ─────────────────────────────────────────────────────
function createTokenAndRespond(user, res) {
  const token = jwt.sign(
    { userId: user._id, nickname: user.nickname, phoneNumber: user.phoneNumber },
    JWT_SECRET
  );
  res.status(200).json({ loginSuccess: true, token, userId: user._id });
}

// ─────────────────────────────────────────────────────
// 회원가입/로그인/소셜
// ─────────────────────────────────────────────────────
exports.signupUser = async (req, res) => {
  try {
    const { phoneNumber, referralCode, nickname, provider, providerId } = req.body;
    if (phoneNumber && phoneNumber.length > 12) {
      return res.status(400).json({ success: false, message: '휴대폰 번호는 12자 이하로 입력해주세요.' });
    }

    const referral = await generateUniqueReferralCode();
    const user = new User({
      ...req.body,
      provider: provider || 'local',
      providerId: provider && provider !== 'local' ? providerId : undefined,
      referralCode: referral,
    });
    const savedUser = await user.save();

    if (referralCode) {
      const refUser = await User.findOne({ referralCode });
      if (refUser) {
        await Point.create({
          user: refUser._id, type: '추가', amount: 500, description: '친구 추천 보상',
          totalAmount: await calculateTotalPoint(refUser._id) + 500, createdAt: new Date(),
        });
        await Notification.create({
          userId: refUser._id, message: `친구 추천 보상 500P가 적립되었습니다.`, url: '/pointInfo', createdAt: new Date(),
        });
        await Point.create({
          user: savedUser._id, type: '추가', amount: 1000, description: '추천 가입 보상',
          totalAmount: 1000, createdAt: new Date(),
        });
        await Notification.create({
          userId: savedUser._id, message: `추천 가입 보상 1000P가 적립되었습니다.`, url: '/pointInfo', createdAt: new Date(),
        });
        refUser.referredBy = refUser.referredBy || [];
        refUser.referredBy.push(savedUser._id);
        await refUser.save();
      }
    }

    const token = jwt.sign({ userId: savedUser._id }, JWT_SECRET, { expiresIn: '3h' });
    return res.status(200).json({ success: true, token });
  } catch (err) {
    console.error('회원가입 실패:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ success: false, message: `이미 사용 중인 ${field}입니다.` });
    }
    return res.status(500).json({ success: false, err });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.json({ loginSuccess: false, message: '이메일을 다시 확인하세요.' });
    const isMatch = await user.comparePassword(req.body.password);
    if (!isMatch) return res.json({ loginSuccess: false, message: '비밀번호가 틀렸습니다' });
    if (!user.is_active) return res.json({ loginSuccess: false, message: '승인 대기 중입니다.' });
    createTokenAndRespond(user, res);
  } catch (err) {
    console.error('로그인 실패:', err);
    res.status(400).send(err);
  }
};

exports.socialLogin = async (req, res) => {
  try {
    const { provider, providerId, email } = req.body;
    console.log(`🔐 socialLogin req: provider=${provider}, providerId=${providerId}, email=${email || '(none)'}`);
    const user = await User.findOne({ provider, providerId });
    if (!user) return res.json({ exists: false });
    if (!user.is_active) return res.json({ loginSuccess: false, message: '승인 대기 중입니다.' });
    createTokenAndRespond(user, res);
  } catch (err) {
    console.error('❌ 소셜 로그인 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
};

// 관리자 로그인 (기존 로직 유지)
exports.loginAdmin = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.json({ loginSuccess: false, message: '이메일을 다시 확인하세요.' });
    const isMatch = await user.comparePassword(req.body.password);
    if (!isMatch) return res.json({ loginSuccess: false, message: '비밀번호가 틀렸습니다' });
    if (!user.is_active) return res.json({ loginSuccess: false, message: '승인 대기 중입니다.' });
    if (!['1', '2'].includes(user.user_type)) {
      return res.json({ loginSuccess: false, message: '관리자 또는 부관리자가 아닙니다.' });
    }
    const token = jwt.sign(
      { userId: user._id, nickname: user.nickname, phoneNumber: user.phoneNumber },
      JWT_SECRET,
      { expiresIn: '48h' }
    );
    res.status(200).json({ loginSuccess: true, token });
  } catch (err) {
    console.error('관리자 로그인 실패:', err);
    res.status(400).send(err);
  }
};

// ─────────────────────────────────────────────────────
// 조회 (프리사인 포함)
// ─────────────────────────────────────────────────────
exports.getAllUsersInfo = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    jwt.verify(token, JWT_SECRET);

    const users = await User.find().select('-password');
    if (!users || users.length === 0) {
      return res.status(200).json({ success: true, totalUsers: 0, users: [] });
    }

    const withUrls = await Promise.all(users.map(u => attachUserSignedUrl(u, 60 * 5)));
    res.status(200).json({ success: true, totalUsers: withUrls.length, users: withUrls });
  } catch (err) {
    console.error('모든 유저 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

exports.getUserInfo = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });

    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' }); }

    const userId = decoded.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 유저 ID입니다.' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });

    const u = await attachUserSignedUrl(user, 60 * 10);
    return res.status(200).json({ success: true, user: u });
  } catch (err) {
    console.error('유저 정보 조회 실패:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

exports.getUserInfoByid = async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });

  try {
    jwt.verify(token, JWT_SECRET);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 유저 ID입니다.' });
    }
    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });

    const u = await attachUserSignedUrl(user, 60 * 10);
    res.status(200).json({ success: true, user: u });
  } catch (err) {
    console.error('유저 정보 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// ─────────────────────────────────────────────────────
// 사용자 정보 수정
// ─────────────────────────────────────────────────────
exports.updateUserInfo = async (req, res) => {
  const { nickname, phoneNumber } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

    if (nickname) {
      const { ok, message, reasons } = await validateNickname(nickname, { excludeUserId: user._id });
      if (!ok) return res.status(400).json({ success: false, message, reasons });
      user.nickname = nickname;
    }
    if (phoneNumber) user.phoneNumber = phoneNumber;

    await user.save();
    return res.status(200).json({ success: true, message: '사용자 정보가 업데이트되었습니다.' });
  } catch (err) {
    console.error('사용자 정보 수정 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// ─────────────────────────────────────────────────────
// 활성화/권한, 삭제, 비번 변경 등 (기존 유지)
// ─────────────────────────────────────────────────────
exports.updateIsActive = async (req, res) => {
  const { id } = req.params;
  const { is_active, user_type } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });

  try {
    jwt.verify(token, JWT_SECRET);
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });

    if (is_active !== undefined) user.is_active = is_active;
    if (user_type !== undefined) user.user_type = user_type;

    await user.save();
    res.status(200).json({ success: true, message: '유저 정보가 업데이트 되었습니다.' });
  } catch (err) {
    console.error('유저 정보 업데이트 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });

  try {
    jwt.verify(token, JWT_SECRET);
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });

    // S3 프로필 이미지 정리
    if (user.profileImage) {
      await deleteS3Key(user.profileImage);
    }

    await User.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: '유저 정보가 삭제되었습니다.' });
  } catch (err) {
    console.error('유저 삭제 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) return res.status(400).json({ success: false, message: '기존 비밀번호가 일치하지 않습니다.' });

    user.password = newPassword;
    await user.save();
    return res.status(200).json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch (err) {
    console.error('비밀번호 변경 실패:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

exports.getInactiveUsersCount = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });

  try {
    jwt.verify(token, JWT_SECRET);
    const count = await User.countDocuments({ is_active: false });
    res.status(200).json({ success: true, inactiveUsersCount: count });
  } catch (err) {
    console.error('비활성 유저 수 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

exports.getUserInfoByField = async (req, res) => {
  const { nickname, email } = req.query;
  if (!nickname && !email) {
    return res.status(400).json({ success: false, message: 'nickname 또는 email 중 하나를 제공해주세요.' });
  }
  try {
    let query = {};
    let type = '';
    if (nickname) { query = { nickname }; type = 'nickname'; }
    else if (email) { query = { email }; type = 'email'; }

    const user = await User.findOne(query);
    if (!user) return res.status(200).json({ success: true, exists: false, message: `사용 가능한 ${type}입니다.` });
    return res.status(200).json({ success: true, exists: true, message: `이미 사용 중인 ${type}입니다.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

exports.checkDuplicate = async (req, res) => {
  const { nickname, email } = req.body;
  try {
    if (nickname != null) {
      const result = await validateNickname(nickname);
      return res.json({ exists: result.exists, ok: result.ok, reasons: result.reasons, message: result.message });
    }
    if (email != null) {
      const exists = await User.findOne({ email });
      return res.json({ exists: !!exists });
    }
    return res.status(400).json({ message: 'nickname 또는 email이 필요합니다.' });
  } catch (err) {
    return res.status(500).json({ message: '서버 오류' });
  }
};

exports.checkReferralCode=  async (req, res) => {
  const { referralCode } = req.body;
  try {
    if (referralCode) {
      const exists = await User.findOne({ referralCode });
      return res.json({ exists: !!exists });
    }
    return res.status(400).json({ message: '추천인 코드가 필요합니다' });
  } catch (err) {
    return res.status(500).json({ message: '서버 오류' });
  }
};

// ─────────────────────────────────────────────────────
// 프로필 이미지 업로드 (multer-s3)
// form-data 필드명: 'profileImage'
// DB에는 key만 저장, 응답에 presigned URL 포함
// ─────────────────────────────────────────────────────
const uploadProfileToS3 = multer({
  storage: multerS3({
    s3,
    bucket: S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    acl: 'private',
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      const base = path.basename(file.originalname, ext).replace(/[^\w.-]/g, '_');
      const key = `profile_images/${Date.now()}-${base}${ext}`;
      cb(null, key);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('profileImage');

exports.uploadProfileImage = [
  uploadProfileToS3,
  async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });
      if (!req.file) return res.status(400).json({ success: false, message: '이미지 파일이 없습니다.' });

      const newKey = req.file.key;

      // 기존 S3 이미지 정리
      if (user.profileImage) {
        await deleteS3Key(user.profileImage);
      }

      user.profileImage = newKey; // DB에는 key만 저장
      await user.save();

      const url = await presign(newKey, 60 * 10);
      return res.status(200).json({
        success: true,
        message: '프로필 이미지가 업로드되었습니다.',
        profileImageKey: newKey,
        profileImageUrl: url,
      });
    } catch (err) {
      console.error('프로필 업로드 실패:', err);
      return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
];

// ─────────────────────────────────────────────────────
// Bootpay/비번 초기화/이메일 찾기/회원탈퇴/검색 (기존 유지)
// ─────────────────────────────────────────────────────
function extractTID(responseText) {
  const match = responseText.match(/<TID>(.*?)<\/TID>/);
  return match ? match[1] : '';
}
function extractReturnCode(responseText) {
  const match = responseText.match(/<RETURNCODE>(.*?)<\/RETURNCODE>/);
  return match ? match[1] : '';
}

exports.verifyBootpayAuth = async (req, res) => {
  const { receipt_id } = req.body;
  if (!receipt_id) return res.status(400).json({ success: false, message: 'receipt_id가 없습니다.' });
  try {
    Bootpay.setConfiguration({
      application_id: '61e7c9c9e38c30001f7b824a',
      private_key: 'TiqTbAKWuWAukzmhdSyrctXibabB3ZxM+9unvoAeQKc='
    });
    await Bootpay.getAccessToken();
    const response = await Bootpay.certificate(receipt_id);
    if (response && response.authenticate_data) {
      const auth = response.authenticate_data;
      return res.status(200).json({
        success: true,
        user: { name: auth.name, phone: auth.phone, birth: auth.birth, gender: auth.gender, carrier: auth.carrier }
      });
    } else {
      return res.status(400).json({ success: false, message: '인증 정보가 없습니다.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: '본인인증 검증 중 오류가 발생했습니다.' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: '존재하지 않는 이메일입니다.' });

    const tempPassword = crypto.randomBytes(4).toString('hex');
    user.password = tempPassword;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: { user: 'luckyttangttang@gmail.com', pass: 'dhzqdhcbmhvgaziy' },
    });
    const mailOptions = {
      from: 'luckyttangttang@gmail.com',
      to: email,
      subject: '[럭키탕] 임시 비밀번호 안내',
      text: `안녕하세요. 임시 비밀번호는 [${tempPassword}] 입니다. 로그인 후 반드시 비밀번호를 변경해 주세요.`,
    };
    await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true, message: '임시 비밀번호가 이메일로 전송되었습니다.' });
  } catch (err) {
    return res.status(500).json({ message: '서버 오류' });
  }
};

exports.findEmailByPhone = async (req, res) => {
  const { phoneNumber } = req.query;
  if (!phoneNumber) return res.status(400).json({ success: false, message: '휴대폰 번호가 필요합니다.' });
  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) return res.status(404).json({ success: false, message: '이메일을 찾을 수 없습니다.' });
    return res.status(200).json({ success: true, email: user.email });
  } catch (err) {
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
};

exports.withDrawUser = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });

  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); }
  catch { return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' }); }
  const userId = decoded.userId;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });

  // 연관 데이터 삭제
  await Promise.all([
    Point.deleteMany({ user: userId }),
    Order.deleteMany({ user: userId }),
    qnaQuestion.deleteMany({ user: userId }),
    qnaAnswer.deleteMany({ userId }),
    Shipping.deleteMany({ userId }),
    ShippingOrder.deleteMany({ userId }),
  ]);

  // S3 프로필 이미지 삭제
  if (user.profileImage) {
    await deleteS3Key(user.profileImage);
  }

  await User.findByIdAndDelete(userId);
  await User.updateMany({ referredBy: userId }, { $pull: { referredBy: userId } });

  return res.status(200).json({ success: true, message: '회원 탈퇴가 완료되었습니다.' });
};

exports.searchUsers = async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) return res.status(400).json({ success: false, message: '검색어가 필요합니다.' });
  try {
    const regex = new RegExp(keyword, 'i');
    const users = await User.find({
      $or: [{ nickname: regex }, { email: regex }, { phoneNumber: regex }]
    }).select('_id nickname email phoneNumber');
    res.status(200).json({ success: true, users });
  } catch (err) {
    console.error('사용자 검색 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
};

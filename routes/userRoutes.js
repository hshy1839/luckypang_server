// routes/user.js
const express = require('express');
const jwt = require('jsonwebtoken');

const {
  loginUser,
  signupUser,
  socialLogin,
  getAllUsersInfo,
  updateUserInfo,
  deleteUser,
  getUserInfo,
  getUserInfoByid,
  loginAdmin,
  updateIsActive,
  changePassword,
  getInactiveUsersCount,
  getUserInfoByField,
  checkDuplicate,
  checkReferralCode,
  uploadProfileImage,   // ← 컨트롤러에서 [multer-s3, handler] 배열
  resetPassword,
  verifyBootpayAuth,
  findEmailByPhone,
  withDrawUser,
  searchUsers,
} = require('../controllers/userController');

const router = express.Router();

// ─────────────────────────────────────────────────────
// JWT 인증 (업로드 전에 헤더만 검사: 바디 건드리지 않음)
// ─────────────────────────────────────────────────────
const JWT_SECRET = 'jm_shoppingmall'; // 권장: 환경변수로 이동
function authRequired(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
}

// 로그인/회원
router.post('/login', loginUser);
router.post('/loginAdmin', loginAdmin);
router.post('/social-login', socialLogin);
router.post('/signup', signupUser);

// 유저 조회/수정/삭제
router.get('/userinfo', getAllUsersInfo);
router.get('/userCheck', getUserInfoByField);
router.get('/userinfoget', getUserInfo);
router.get('/userinfo/:id', getUserInfoByid);
router.put('/userinfo/:id', updateIsActive);
router.get('/inactiveUsersCount', getInactiveUsersCount);
router.put('/changePassword', changePassword);
router.put('/userinfoUpdate', updateUserInfo);
router.delete('/userinfo/:id', deleteUser);

// ✅ 프로필 이미지 업로드 (S3)
// ❌ 기존: upload.fields([...])  ← 제거!
// ✅ 컨트롤러의 [multer-s3, handler]만 사용
router.post('/profile', authRequired, ...uploadProfileImage);

// 부가 기능
router.post('/bootpay/verify-auth', verifyBootpayAuth);
router.post('/reset-password', resetPassword);
router.get('/findEmail', findEmailByPhone);
router.delete('/withdraw', withDrawUser);
router.get('/search', searchUsers);

module.exports = router;

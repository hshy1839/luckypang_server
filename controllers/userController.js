const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const  Order  = require('../models/Order');
const { qnaAnswer } = require('../models/QnaAnswer');
const { qnaQuestion } = require('../models/QnaQuestion');
const Shipping = require('../models/Shipping');
const ShippingOrder = require('../models/ShippingOrder');
const JWT_SECRET = 'jm_shoppingmall';
const path = require('path');
const fs = require('fs');
const mongoose = require("mongoose");
const multer = require('multer');
const axios = require('axios');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const iconv = require('iconv-lite');
const qs = require('querystring');
const Bootpay = require('@bootpay/backend-js').default;
const Notification = require('../models/Notification');


const requestIp = require('request-ip');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'profileImage') {
      cb(null, 'uploads/profile_images/'); // promotionImage는 promotion_images 폴더에 저장
    } else {
      cb(new Error('Invalid field name'), null); // 유효하지 않은 필드명이면 에러
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // 파일명에 타임스탬프 추가
  },
});

const upload = multer({ storage: storage });

// 랜덤 코드 생성
const generateRandomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// 중복 없는 코드 생성
const generateUniqueReferralCode = async () => {
  let code;
  while (true) {
    code = generateRandomCode();
    const exists = await User.exists({ referralCode: code });
    if (!exists) break;
  }
  return code;
};

const createTokenAndRespond = (user, res) => {
  const token = jwt.sign(
    { userId: user._id, nickname: user.nickname, phoneNumber: user.phoneNumber },
    JWT_SECRET
  );
  res.status(200).json({ loginSuccess: true, token, userId: user._id });
};

// 회원가입
const Point = require('../models/Point'); // 상단에 추가

// 상단 require 아래 유틸/블랙리스트 부분 교체

let blacklistSet = new Set();
const BL_PATH = path.join(__dirname, '..', 'blacklist.txt');

function escapeRegex(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 간단 normalize (우회 방지 기본치)
function normalize(s = '') {
  let out = String(s).toLowerCase();

  // 한글 'ㅣ'(세로획) → 영문 l
  out = out.replace(/ㅣ/g, 'l');

  // leet 치환
  out = out
    .replaceAll('0','o')
    .replaceAll('1','l')
    .replaceAll('3','e')
    .replaceAll('4','a')
    .replaceAll('5','s')
    .replaceAll('7','t')
    .replaceAll('8','b');

  // 공백/제로폭 제거
  out = out.replace(/\s+/g, '');
  out = out.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 한글/영문/숫자만
  out = out.replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ]/g, '');
  return out;
}

function loadBlacklist() {
  try {
    let raw = fs.readFileSync(BL_PATH, 'utf8');
    // BOM 제거
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

    blacklistSet = new Set(
      raw
        .split(/\r?\n/)
        .map(w => normalize(w))
        .filter(Boolean)
    );
  } catch (e) {
    blacklistSet = new Set();
  }
}

// 파일 변경 시 자동 리로드(선택)
try {
  fs.watch(BL_PATH, { persistent: false }, () => {
    loadBlacklist();
  });
} catch (_) {}
loadBlacklist();

function isBlacklisted(nickname) {
  const norm = normalize(nickname);
  for (const bad of blacklistSet) {
    if (!bad) continue;
    if (norm.includes(bad)) {
      return true;
    }
  }
  return false;
}

// 파일 변경 시 자동 리로드(선택)
fs.watch(BL_PATH, { persistent: false }, () => {
  loadBlacklist();
});
loadBlacklist();

function isBlacklisted(nickname) {
  const norm = normalize(nickname);
  for (const bad of blacklistSet) {
    if (!bad) continue;
    if (norm.includes(bad)) return true; // 과하면 equals/startsWith로 완화 가능
  }
  return false;
}

async function validateNickname(nickname, { excludeUserId = null } = {}) {
  const raw = nickname;
  const trimmed = String(nickname || '').trim();
  const norm = normalize(trimmed);

  const reasons = [];

  if (trimmed.length < 2 || trimmed.length > 8) {
    reasons.push('length');
  }

  const blacklisted = isBlacklisted(trimmed);
  if (blacklisted) {
    reasons.push('blacklist');
  }

  // 대소문자 무시 완전일치(정규식) + 자기 자신 제외
  const regex = new RegExp(`^${escapeRegex(trimmed)}$`, 'i');
  const dupQuery = excludeUserId
    ? { _id: { $ne: excludeUserId }, nickname: regex }
    : { nickname: regex };

  let exists = false;
  try {
    exists = await User.exists(dupQuery);
  } catch (e) {
  }

  if (exists) reasons.push('duplicate');

  const ok = reasons.length === 0;
  const message = ok
    ? '사용 가능한 닉네임 입니다.'
    : (reasons.includes('blacklist')
        ? '사용할 수 없는 닉네임 입니다.'
        : reasons.includes('duplicate')
          ? '이미 사용 중인 닉네임입니다.'
          : '닉네임은 2~8자입니다.');

  return { ok, reasons, message, exists: !!exists };
}


exports.signupUser = async (req, res) => {
  try {
    const { phoneNumber, referralCode, nickname, provider, providerId } = req.body;

    if (phoneNumber && phoneNumber.length > 12) {
      return res.status(400).json({ success: false, message: '휴대폰 번호는 12자 이하로 입력해주세요.' });
    }

    const referral = await generateUniqueReferralCode();

    // 신규 유저 생성
    const user = new User({
      ...req.body,
      provider: provider || 'local',
      providerId: provider !== 'local' ? providerId : undefined,
      referralCode: referral,
    });

    const savedUser = await user.save(); // 먼저 저장 (user._id 필요)

    // 추천 코드 유효 시 포인트 지급 로직
    if (referralCode) {
      const refUser = await User.findOne({ referralCode });
      if (refUser) {
        // 추천한 사람: 1000P
        await Point.create({
          user: refUser._id,
          type: '추가',
          amount: 500,
          description: '친구 추천 보상',
          totalAmount: await calculateTotalPoint(refUser._id) + 500,
          createdAt: new Date(),
        });

       await Notification.create({
      userId: refUser._id,
      message: `친구 추천 보상 500P가 적립되었습니다.`,
      url: '/pointInfo',
      createdAt: new Date(),
    });

        // 추천받은 사람(가입자): 500P
        await Point.create({
          user: savedUser._id,
          type: '추가',
          amount: 1000,
          description: '추천 가입 보상',
          totalAmount: 1000, // 신규 가입자는 처음이므로 500 그대로
          createdAt: new Date(),
        });

        await Notification.create({
      userId: savedUser._id,
      message: `추천 가입 보상 1000P가 적립되었습니다.`,
      url: '/pointInfo',
      createdAt: new Date(),
    });

        // (선택) 추천인 관계 저장 (refUser 입장에서 누가 추천 받았는지)
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


const calculateTotalPoint = async (userId) => {
  const points = await Point.find({ user: userId });
  return points.reduce((acc, p) => {
    if (p.type === '추가' || p.type === '환불') return acc + p.amount;
    if (p.type === '감소') return acc - p.amount;
    return acc;
  }, 0);
};



// 사용자 로그인
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
    if (!user) {
      console.log('ℹ️ socialLogin: 기존 회원 없음 → 회원가입 플로우로');
      return res.json({ exists: false });
    }
    if (!user.is_active) {
      console.log(`⛔ socialLogin: 비활성 사용자 userId=${user._id}`);
      return res.json({ loginSuccess: false, message: '승인 대기 중입니다.' });
    }
    console.log(`🟢 socialLogin: 로그인 성공 userId=${user._id}`);
    createTokenAndRespond(user, res);
  } catch (err) {
    console.error('❌ 소셜 로그인 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
};


// 관리자 로그인
exports.loginAdmin = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.json({ loginSuccess: false, message: '이메일을 다시 확인하세요.' });
    }

    const isMatch = await user.comparePassword(req.body.password);
    if (!isMatch) {
      return res.json({ loginSuccess: false, message: '비밀번호가 틀렸습니다' });
    }

    if (!user.is_active) {
      return res.json({ loginSuccess: false, message: '승인 대기 중입니다.' });
    }

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

// 전체 유저 조회
exports.getAllUsersInfo = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    jwt.verify(token, JWT_SECRET);

    const users = await User.find().select('-password');
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });
    }

    res.status(200).json({ success: true, totalUsers: users.length, users });
  } catch (err) {
    console.error('모든 유저 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 내 정보 조회
exports.getUserInfo = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }

    const userId = decoded.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 유저 ID입니다.' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });
    }

    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('유저 정보 조회 실패:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};


// 특정 유저 조회 by ID
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

    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('유저 정보 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 사용자 정보 수정
exports.updateUserInfo = async (req, res) => {
  const { nickname, phoneNumber } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

    if (nickname) {
      // ✅ 자기 자신 제외하고 검증
      const { ok, message, reasons } = await validateNickname(nickname, { excludeUserId: user._id });
      if (!ok) {
        return res.status(400).json({ success: false, message, reasons });
      }
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


// 활성화 상태 및 권한 수정
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

// 유저 삭제
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });

  try {
    jwt.verify(token, JWT_SECRET);

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });

    await User.findByIdAndDelete(id);
    // 관련된 다른 컬렉션이 있다면 여기에 삭제 추가

    res.status(200).json({ success: true, message: '유저 정보가 삭제되었습니다.' });
  } catch (err) {
    console.error('유저 삭제 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 비밀번호 변경
exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: '기존 비밀번호가 일치하지 않습니다.' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch (err) {
    console.error('비밀번호 변경 실패:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 비활성 유저 수 조회
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

// userinfo (nickname 또는 email 존재 여부 확인)
exports.getUserInfoByField = async (req, res) => {
  const { nickname, email } = req.query;

  if (!nickname && !email) {
    return res.status(400).json({ success: false, message: 'nickname 또는 email 중 하나를 제공해주세요.' });
  }

  try {
    let query = {};
    let type = '';

    if (nickname) {
      query = { nickname };
      type = 'nickname';
    } else if (email) {
      query = { email };
      type = 'email';
    }

    const user = await User.findOne(query);

    if (!user) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: `사용 가능한 ${type}입니다.`,
      });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      message: `이미 사용 중인 ${type}입니다.`,
    });
  } catch (err) {
    console.error(`${type} 중복 검사 오류:`, err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

exports.checkDuplicate = async (req, res) => {
  const { nickname, email } = req.body;

  try {
    if (nickname != null) {
      const result = await validateNickname(nickname);
      // 하위호환(exists) + 신규(ok/reasons/message)
      return res.json({
        exists: result.exists,
        ok: result.ok,
        reasons: result.reasons,
        message: result.message,
      });
    }

    if (email != null) {
      const exists = await User.findOne({ email });
      return res.json({ exists: !!exists });
    }

    return res.status(400).json({ message: 'nickname 또는 email이 필요합니다.' });
  } catch (err) {
    console.error(err);
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
    console.error(err);
    return res.status(500).json({ message: '서버 오류' });
  }
};

exports.uploadProfileImage = [
  upload.single('profileImage'),
  async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user) {
        return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: '이미지 파일이 없습니다.' });
      }

      // 기존 이미지 삭제 (선택 사항)
      if (user.profileImage && fs.existsSync(user.profileImage)) {
        fs.unlinkSync(user.profileImage);
      }

      // 저장 경로 업데이트
      const imagePath = req.file.path.replace(/\\/g, '/'); // 윈도우 호환
      user.profileImage = imagePath;
      await user.save();

      return res.status(200).json({
        success: true,
        message: '프로필 이미지가 업로드되었습니다.',
        imagePath,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
];

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

  if (!receipt_id) {
    return res.status(400).json({ success: false, message: 'receipt_id가 없습니다.' });
  }

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
        user: {
          name: auth.name,
          phone: auth.phone,
          birth: auth.birth,
          gender: auth.gender,
          carrier: auth.carrier
        }
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

    // ✅ 임시 비밀번호 생성 (8자리 랜덤 문자열)
    const tempPassword = crypto.randomBytes(4).toString('hex');

    user.password = tempPassword;   
await user.save();              
    // ✅ 이메일 발송 설정
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: 'luckyttangttang@gmail.com',
        pass: 'dhzqdhcbmhvgaziy', // Gmail은 앱 비밀번호 사용
      },
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

// 전화번호로 이메일 찾기
exports.findEmailByPhone = async (req, res) => {
  const { phoneNumber } = req.query;
  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: '휴대폰 번호가 필요합니다.' });
  }
  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ success: false, message: '이메일을 찾을 수 없습니다.' });
    }
    return res.status(200).json({ success: true, email: user.email });
  } catch (err) {
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
};

exports.withDrawUser = async (req, res) => {
  // 1. 토큰 꺼내고 검증
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
  const userId = decoded.userId;

  // 2. 유저 존재 확인
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });

  // 3. 연관 데이터 삭제
  await Promise.all([
    Point.deleteMany({ user: userId }),
    Order.deleteMany({ user: userId }),
    qnaQuestion.deleteMany({ user: userId }),
    qnaAnswer.deleteMany({ userId: userId }),
    Shipping.deleteMany({ userId: userId }),
    ShippingOrder.deleteMany({ userId:  userId }),
  ]);

  // 4. user 삭제 (최종)
  await User.findByIdAndDelete(userId);

  // 5. (옵션) referredBy 배열에서도 제거
  await User.updateMany(
    { referredBy: userId },
    { $pull: { referredBy: userId } }
  );

  return res.status(200).json({ success: true, message: '회원 탈퇴가 완료되었습니다.' });
};

exports.searchUsers = async (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ success: false, message: '검색어가 필요합니다.' });
  }

  try {
    const regex = new RegExp(keyword, 'i'); // 대소문자 구분 없이 검색
    const users = await User.find({
      $or: [
        { nickname: regex },
        { email: regex },
        { phoneNumber: regex }
      ]
    }).select('_id nickname email phoneNumber');

    res.status(200).json({ success: true, users });
  } catch (err) {
    console.error('사용자 검색 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
};
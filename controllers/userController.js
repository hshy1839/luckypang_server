const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const JWT_SECRET = 'jm_shoppingmall';
const path = require('path');
const fs = require('fs');
const mongoose = require("mongoose");
const multer = require('multer');


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
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// 중복 없는 코드 생성
const generateUniqueReferralCode = async () => {
  let code;
  let exists = true;

  while (exists) {
    code = generateRandomCode();
    exists = await User.exists({ referralCode: code });
  }

  return code;
};

// 회원가입
exports.signupUser = async (req, res) => {
  try {
    const { phoneNumber, referralCode, nickname } = req.body;

    if (phoneNumber && phoneNumber.length > 12) {
      return res.status(400).json({
        success: false,
        message: "휴대폰 번호는 12자 이하로 입력해주세요.",
      });
    }

    // 고유 추천 코드 생성
    const generatedCode = await generateUniqueReferralCode();

    // 새로운 유저 생성
    const user = new User({
      ...req.body,
      referralCode: generatedCode,
    });

    const savedUser = await user.save();

    // ✅ 추천인 코드가 유효한 경우 -> 추천한 유저의 referredBy 에 추가
    if (referralCode) {
      const referringUser = await User.findOne({ referralCode });

      if (referringUser) {
        referringUser.referredBy = referringUser.referredBy || [];
        referringUser.referredBy.push(nickname);
        await referringUser.save();
      }
    }

    const token = jwt.sign({ userId: savedUser._id }, JWT_SECRET, { expiresIn: '3h' });

    return res.status(200).json({ success: true, token });
  } catch (err) {
    console.error('회원가입 실패:', err.code, err);
    if (err.code === 11000) {
      const duplicatedField = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `이미 사용 중인 ${duplicatedField}입니다.`,
      });
    }

    return res.status(500).json({ success: false, err });
  }
};


// 사용자 로그인
exports.loginUser = async (req, res) => {
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

    const token = jwt.sign(
      { userId: user._id, nickname: user.nickname, phoneNumber: user.phoneNumber },
      JWT_SECRET
    );

    // ✅ userId 포함해서 응답
    res.status(200).json({
      loginSuccess: true,
      token,
      userId: user._id
    });
  } catch (err) {
    console.error('로그인 실패:', err);
    res.status(400).send(err);
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

    if (nickname) user.nickname = nickname;
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

exports.checkDuplicate=  async (req, res) => {
  const { nickname, email } = req.body;

  try {
    if (nickname) {
      const exists = await User.findOne({ nickname });
      return res.json({ exists: !!exists });
    }
    if (email) {
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
      console.error('프로필 이미지 업로드 오류:', err);
      return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }
];
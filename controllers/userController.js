const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const JWT_SECRET = 'jm_shoppingmall';
const mongoose = require("mongoose");

// 로그인 컨트롤러
exports.loginAdmin = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (!user) {
      return res.json({
        loginSuccess: false,
        message: '아이디를 다시 확인하세요.',
      });
    }

    const isMatch = await user.comparePassword(req.body.password);
    if (!isMatch) {
      return res.json({
        loginSuccess: false,
        message: '비밀번호가 틀렸습니다',
      });
    }

    if (!user.is_active) {
      return res.json({
        loginSuccess: false,
        message: '승인 대기 중입니다.',
      });
    }

    if (!['1', '2'].includes(user.user_type)) {
      return res.json({
        loginSuccess: false,
        message: '관리자 또는 부관리자가 아닙니다.',
      });
    }
    

    const token = jwt.sign(
      { userId: user._id, username: user.username, phoneNumber: user.phoneNumber },
      JWT_SECRET,
      { expiresIn: '48h' }
    );

    res.status(200).json({ loginSuccess: true, token });
  } catch (err) {
    console.error('로그인 실패:', err);
    res.status(400).send(err);
  }
};

exports.loginUser = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (!user) {
      return res.json({
        loginSuccess: false,
        message: '아이디를 다시 확인하세요.',
      });
    }

    const isMatch = await user.comparePassword(req.body.password);
    if (!isMatch) {
      return res.json({
        loginSuccess: false,
        message: '비밀번호가 틀렸습니다',
      });
    }

    if (!user.is_active) {
      return res.json({
        loginSuccess: false,
        message: '승인 대기 중입니다.',
      });
    }


    const token = jwt.sign(
      { userId: user._id, username: user.username, phoneNumber: user.phoneNumber },
      JWT_SECRET,
    );

    res.status(200).json({ loginSuccess: true, token });
  } catch (err) {
    console.error('로그인 실패:', err);
    res.status(400).send(err);
  }
};

// 회원가입 컨트롤러
exports.signupUser = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // 🔐 12자리 이상이면 에러 처리
    if (phoneNumber && phoneNumber.length > 11) {
      return res.status(400).json({
        success: false,
        message: "휴대폰 번호는 12자 이하로 입력해주세요.",
      });
    }

    const user = new User(req.body);
    const userInfo = await user.save();

    const token = jwt.sign({ userId: userInfo._id }, JWT_SECRET, { expiresIn: '3h' });
    return res.status(200).json({ success: true, token });

  } catch (err) {
    console.error('회원가입 실패:', err.code, err);

    // 중복 키 에러 처리
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


//모든 유저 정보 조회
exports.getAllUsersInfo = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer 토큰에서 추출
    if (!token) {
      return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    }

    // 토큰 검증
    jwt.verify(token, JWT_SECRET); // 토큰만 검증, 특정 유저 정보는 확인하지 않음
    // 모든 유저 정보 조회 (비밀번호 제외)
    const users = await User.find().select('-password');
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });
    }

    // 조회한 유저 정보 반환
    res.status(200).json({ 
      success: true, 
      totalUsers: users.length, // 유저 수
      users, // 유저 데이터 배열
    });
  } catch (err) {
    console.error('모든 유저 정보 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

//특정 유저 정보 조회
exports.getUserInfo = async (req, res) => {
  try {
    // Authorization 헤더에서 토큰 추출
    const token = req.headers.authorization?.split(' ')[1]; // Bearer 토큰에서 추출
    if (!token) {
      return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    } 
    // 토큰 검증
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);  // 토큰 검증 후 디코딩
    } catch (error) {
      console.error('토큰 검증 실패:', error);  // 오류 로그
      return res.status(401).json({ success: false, message: '유효하지 않거나 만료된 토큰입니다.' });
    }
    
    const userId = decoded.userId;  // 토큰에서 유저 ID 추출

    // 유저 정보 조회 (비밀번호 제외)
    const user = await User.findById(userId).select('-password');
    if (!user) {
      console.error('유저를 찾을 수 없음:', userId);  // 유저 ID가 없을 경우 로그
      return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });
    }

    // 유저 정보 반환
    res.status(200).json({
      success: true,
      user,  // 로그인한 유저 정보
    });
  } catch (err) {
    console.error('서버 오류 발생:', err);  // 서버 오류 로그
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

//아이디를 통한 특정 유저 조회
exports.getUserInfoByid = async (req, res) => {
  const { id } = req.params; // URL 파라미터에서 유저 ID 가져오기

  // Authorization 헤더에서 토큰 추출
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
  }

  try {
    // JWT 검증 및 디코딩
    const decoded = jwt.verify(token, JWT_SECRET);
    const requestorId = decoded.userId; // 토큰에서 요청자의 ID 가져오기

    // `id`가 유효한 ObjectId인지 확인
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 유저 ID입니다.' });
    }

    // 데이터베이스에서 유저 정보 검색
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });
    }

    // 유저 정보 반환
    res.status(200).json({
      success: true,
      user: {
        name: user.name,
        phoneNumber: user.phoneNumber,
        email: user.email,
        username: user.username,
      },
    });
  } catch (err) {
    console.error('유저 정보 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};


//사용자 정보 수정 로직
exports.updateUserInfo = async (req, res) => {
  const { name, phoneNumber } = req.body; // 요청 본문에서 업데이트할 데이터 추출

  // Authorization 헤더에서 토큰 추출
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
  }

  try {
    // JWT 토큰 검증 및 사용자 ID 추출
    const decoded = jwt.verify(token, JWT_SECRET); // process.env.JWT_SECRET 사용
    const userId = decoded.userId; // 토큰에서 사용자 ID 추출

    // 사용자 정보 검색
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    // 업데이트할 필드만 수정
    if (name) user.name = name;
    if (phoneNumber) user.phoneNumber = phoneNumber;

    // 변경 사항 저장
    await user.save();

    return res.status(200).json({ success: true, message: '사용자 정보가 업데이트되었습니다.' });
  } catch (err) {
    console.error('사용자 정보 업데이트 중 오류 발생:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};


exports.updateIsActive = async (req, res) => {
  const { id } = req.params;  // URL 파라미터로 받은 유저 ID
  const { is_active, user_type } = req.body;  // 요청 본문에서 받은 업데이트 정보

  // Authorization 헤더에서 토큰 추출
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
  }

  try {
    // 환경 변수에서 JWT_SECRET 가져오기
    const decoded = jwt.verify(token, JWT_SECRET);  // JWT_SECRET 사용
    const userId = decoded.userId;

    // 유저 정보 찾기
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });
    }

    // is_active 값 업데이트 (변경 사항이 있는 경우)
    if (is_active !== undefined) {
      user.is_active = is_active;
    }

    // user_type 값 업데이트 (변경 사항이 있는 경우)
    if (user_type !== undefined) {
      user.user_type = user_type;
    }

    // 변경 사항 저장
    await user.save();

    return res.status(200).json({ success: true, message: '유저 정보가 업데이트 되었습니다.' });
  } catch (err) {
    console.error('유저 정보 업데이트 중 오류 발생:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};



// 유저 삭제 처리
exports.deleteUser = async (req, res) => {
  const { id } = req.params;  // URL 파라미터에서 ID 받기

  // Authorization 헤더에서 토큰 추출
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
      return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
  }

  try {
      // 토큰 검증
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId;

      // 유저 정보 찾기
      const user = await User.findById(id);
      if (!user) {
          return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });
      }

      // 해당 유저 삭제
      await User.findByIdAndDelete(id);

      // 연관된 배송지 정보 삭제
      await Shipping.deleteMany({ userId: id });

      return res.status(200).json({ success: true, message: '유저와 관련된 모든 정보가 삭제되었습니다.' });
  } catch (err) {
      console.error('유저 삭제 중 오류 발생:', err);
      return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 비밀번호 변경 컨트롤러
exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body; // 요청 본문에서 이전 및 새 비밀번호 추출

  // Authorization 헤더에서 토큰 추출
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
  }

  try {
    // JWT 토큰 검증 및 사용자 ID 추출
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // 사용자 검색
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    // 기존 비밀번호 검증
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: '기존 비밀번호가 일치하지 않습니다.' });
    }

    // 새 비밀번호 저장
    user.password = newPassword;
    await user.save();

    return res.status(200).json({ success: true, message: '비밀번호가 성공적으로 변경되었습니다.' });
  } catch (err) {
    console.error('비밀번호 변경 중 오류 발생:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 비활성 유저 개수 조회
exports.getInactiveUsersCount = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    }

    jwt.verify(token, JWT_SECRET);

    // is_active가 false인 유저 수 계산
    const inactiveUsersCount = await User.countDocuments({ is_active: false });

    res.status(200).json({
      success: true,
      inactiveUsersCount,
    });
  } catch (err) {
    console.error('비활성 유저 개수 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: err });
  }
};

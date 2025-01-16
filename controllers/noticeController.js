const jwt = require('jsonwebtoken');
const { Notice } = require('../models/Notice');
const JWT_SECRET = 'jm_shoppingmall';
const mongoose = require("mongoose");

// 공지사항 추가
exports.createNotice = async (req, res) => {
  try {
    // 요청 헤더에서 Authorization 토큰 추출
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      return res.status(403).json({ success: false, message: 'Token is required' });
    }

    // JWT 토큰 검증
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error('Token verification failed:', err);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // 토큰 검증 후 userId가 없는 경우 처리
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ success: false, message: 'Token does not contain userId' });
    }

    // 공지사항 데이터 생성
    const { title, content, created_at, authorName } = req.body;

    // 새로운 공지사항 객체 생성
    const notice = new Notice({
      title,
      content,
      created_at: created_at || new Date().toISOString(), // created_at 없으면 현재 시간으로 설정
      authorName,
      authorId: decoded.userId, // 토큰에서 가져온 userId로 작성자 ID 설정
    });

    // 공지사항 DB에 저장
    const createNotice = await notice.save();

    // 공지사항 저장 성공 시 응답
    return res.status(200).json({
      success: true,
      notice: createNotice,
    });
  } catch (err) {
    console.error('공지사항 등록 실패:', err);

    // 중복 키 에러 처리 (예: 제목이 중복되는 경우)
    if (err.code === 11000) {
      const duplicatedField = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `이미 사용 중인 ${duplicatedField}입니다.`,
      });
    }

    // 기타 오류 처리
    return res.status(500).json({
      success: false,
      message: '공지사항 등록 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

//모든 공지 조회
exports.getAllNotice = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]; // Bearer 토큰에서 추출
        if (!token) {
            return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
        }

        // 토큰 검증
        const decoded = jwt.verify(token, JWT_SECRET); // 토큰만 검증, 특정 유저 정보는 확인하지 않음
      

        // 공지사항 조회
        const notices = await Notice.find();
        if (!notices || notices.length === 0) {
            return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
        }

        res.status(200).json({
            success: true,
            totalNotices: notices.length,
            notices: notices,
        });
    } catch (err) {
        console.error('모든 공지사항 조회 실패:', err);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 특정 공지 조회
exports.getNotice = async (req, res) => {
    const { id } = req.params;

    // 디버깅 로그 추가

    // ID 유효성 확인
    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.error('유효하지 않은 공지 ID:', id);
        return res.status(400).json({ success: false, message: '유효하지 않은 공지 ID입니다.' });
    }

    try {
        // 토큰 검증
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.error('토큰 누락: 인증 실패');
            return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        // 공지 조회
        const notice = await Notice.findById(id);
        if (!notice) {
            console.error('공지 없음:', id);
            return res.status(404).json({ success: false, message: '공지를 찾을 수 없습니다.' });
        }

        return res.status(200).json({ success: true, notice });
    } catch (err) {
        console.error('공지 조회 중 오류:', err);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};
//공지 삭제
exports.deleteNotice = async (req, res) => {
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
        const notice = await Notice.findById(id);
        if (!notice) {
            return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });
        }
  
        // 해당 공지 삭제
        await Notice.findByIdAndDelete(id);
  
        return res.status(200).json({ success: true, message: '공지가 삭제되었습니다.' });
    } catch (err) {
        console.error('공지 삭제 중 오류 발생:', err);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  };

  // 공지 수정 API
exports.updateNotice = async (req, res) => {
    const { id } = req.params;  // URL 파라미터로 받은 공지글 ID
    const { title, content } = req.body;  // 수정할 제목과 내용

    // Authorization 헤더에서 토큰 추출
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
    }

    try {
        // 환경 변수에서 JWT_SECRET 가져오기
        const decoded = jwt.verify(token,JWT_SECRET);  // process.env.JWT_SECRET 사용
        const userId = decoded.userId;

        // 유저가 공지 수정 권한을 가지고 있는지 확인
        // (예시: 공지 작성자만 수정 가능하도록 조건을 추가할 수 있음)
        const notice = await Notice.findById(id);
        if (!notice) {
            return res.status(404).json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
        }

        // 수정된 제목과 내용 업데이트
        notice.title = title;
        notice.content = content;

        // 공지사항 저장
        await notice.save();

        return res.status(200).json({ success: true, message: '공지사항이 수정되었습니다.' });
    } catch (err) {
        console.error('공지 수정 중 오류 발생:', err);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};
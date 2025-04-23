const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Notice } = require('../models/Notice'); // Promotion 모델 import
const JWT_SECRET = 'jm_shoppingmall';

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'noticeImage') {
      cb(null, 'uploads/notice_images/'); // promotionImage는 promotion_images 폴더에 저장
    } else {
      cb(new Error('Invalid field name'), null); // 유효하지 않은 필드명이면 에러
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // 파일명에 타임스탬프 추가
  },
});

const upload = multer({ storage: storage });

// 프로모션 생성
exports.createNotice = async (req, res) => {
    try {
  

      const token = req.headers['authorization']?.split(' ')[1];
      if (!token) {
        return res.status(403).json({ success: false, message: 'Token is required' });
      }
  
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
        console.log('파일 정보:', req.files);
        console.log('본문:', req.body);
      } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
      }
  
      if (!decoded || !decoded.userId) {
        return res.status(401).json({ success: false, message: 'Token does not contain userId' });
      }
  
      // 파일 처리 후 저장된 경로 추출
      const noticeImages = [];
      if (req.files && req.files.noticeImage) {
        req.files.noticeImage.forEach(file => {
          noticeImages.push('/uploads/notice_images/' + file.filename); // 로컬에 저장된 경로
        });
      }
  
      const { title, content } = req.body; // 텍스트 데이터 받기
  
      if (!title) {
        return res.status(400).json({ success: false, message: 'Name is required' });
      }
  
      // 프로모션 생성
      const notice = new Notice({
        title,
        content,
        noticeImage: noticeImages,
      });
  
      const createdNotice = await notice.save();
  
      return res.status(200).json({
        success: true,
        notice: createdNotice,
      });
    } catch (err) {
      console.error('공지사항 등록 실패:', err);
      return res.status(500).json({
        success: false,
        message: '공지사항 등록 중 오류가 발생했습니다.',
        error: err.message,
      });
    }
  };
  
  // 모든 공지사항 조회
exports.getAllNotices = async (req, res) => {
  try {
    const notices = await Notice.find().sort({ created_at: -1 }); // 최신순 정렬
    res.status(200).json({
      success: true,
      notices,
    });
  } catch (err) {
    console.error('📛 공지사항 목록 불러오기 실패:', err);
    res.status(500).json({
      success: false,
      message: '공지사항 목록 조회 중 오류가 발생했습니다.',
    });
  }
};

exports.getNoticeById = async (req, res) => {
  try {
    const noticeId = req.params.id;

    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json({
        success: false,
        message: '해당 공지사항을 찾을 수 없습니다.',
      });
    }

    return res.status(200).json({
      success: true,
      notice,
    });
  } catch (err) {
    console.error('📛 공지사항 조회 실패:', err);
    return res.status(500).json({
      success: false,
      message: '공지사항 조회 중 오류가 발생했습니다.',
    });
  }
};

// 공지사항 수정
exports.updateNotice = async (req, res) => {
  try {
    const noticeId = req.params.id;

    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      return res.status(403).json({ success: false, message: 'Token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ success: false, message: 'Token does not contain userId' });
    }

    const { title, content } = req.body;

    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json({
        success: false,
        message: '해당 공지사항을 찾을 수 없습니다.',
      });
    }

    // 기존 이미지 삭제 후 새 이미지 저장 (있을 경우)
    if (req.files && req.files.noticeImage && req.files.noticeImage.length > 0) {
      // 기존 이미지 파일 삭제
      if (notice.noticeImage && notice.noticeImage.length > 0) {
        notice.noticeImage.forEach(imgPath => {
          const fullPath = path.join(__dirname, '..', imgPath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        });
      }

      // 새 이미지 저장 경로 설정
      const updatedImages = req.files.noticeImage.map(file => '/uploads/notice_images/' + file.filename);
      notice.noticeImage = updatedImages;
    }

    // 텍스트 필드 업데이트
    notice.title = title || notice.title;
    notice.content = content || notice.content;

    const updatedNotice = await notice.save();

    return res.status(200).json({
      success: true,
      notice: updatedNotice,
    });
  } catch (err) {
    console.error('📛 공지사항 수정 실패:', err);
    return res.status(500).json({
      success: false,
      message: '공지사항 수정 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

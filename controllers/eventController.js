const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Event } = require('../models/Event'); // Promotion 모델 import
const JWT_SECRET = 'jm_shoppingmall';

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'eventImage') {
      cb(null, 'uploads/event_images/'); // promotionImage는 promotion_images 폴더에 저장
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
exports.createEvent = async (req, res) => {
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
      const eventImages = [];
      if (req.files && req.files.eventImage) {
        req.files.eventImage.forEach(file => {
          eventImages.push('/uploads/event_images/' + file.filename); // 로컬에 저장된 경로
        });
      }
  
      const { title, content } = req.body; // 텍스트 데이터 받기
  
      if (!title) {
        return res.status(400).json({ success: false, message: 'Name is required' });
      }
  
      // 프로모션 생성
      const event = new Event({
        title,
        content,
        eventImage: eventImages,
      });
  
      const createdEvent = await event.save();
  
      return res.status(200).json({
        success: true,
        event: createdEvent,
      });
    } catch (err) {
      console.error('이벤트 등록 실패:', err);
      return res.status(500).json({
        success: false,
        message: '이벤트 등록 중 오류가 발생했습니다.',
        error: err.message,
      });
    }
  };
  
  // 모든 이벤트 조회
exports.getAllEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ created_at: -1 }); // 최신순 정렬
    res.status(200).json({
      success: true,
      events,
    });
  } catch (err) {
    console.error('📛 이벤트 목록 불러오기 실패:', err);
    res.status(500).json({
      success: false,
      message: '이벤트 목록 조회 중 오류가 발생했습니다.',
    });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const eventId = req.params.id;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: '해당 이벤트을 찾을 수 없습니다.',
      });
    }

    return res.status(200).json({
      success: true,
      event,
    });
  } catch (err) {
    console.error('📛 이벤트 조회 실패:', err);
    return res.status(500).json({
      success: false,
      message: '이벤트 조회 중 오류가 발생했습니다.',
    });
  }
};

// 이벤트 수정
exports.updateEvent = async (req, res) => {
  try {
    const eventId = req.params.id;

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

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: '해당 이벤트을 찾을 수 없습니다.',
      });
    }

    // 기존 이미지 삭제 후 새 이미지 저장 (있을 경우)
    if (req.files && req.files.eventImage && req.files.eventImage.length > 0) {
      // 기존 이미지 파일 삭제
      if (event.eventImage && event.eventImage.length > 0) {
        event.eventImage.forEach(imgPath => {
          const fullPath = path.join(__dirname, '..', imgPath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        });
      }

      // 새 이미지 저장 경로 설정
      const updatedImages = req.files.eventImage.map(file => '/uploads/event_images/' + file.filename);
      event.eventImage = updatedImages;
    }

    // 텍스트 필드 업데이트
    event.title = title || event.title;
    event.content = content || event.content;

    const updatedEvent = await event.save();

    return res.status(200).json({
      success: true,
      event: updatedEvent,
    });
  } catch (err) {
    console.error('📛 이벤트 수정 실패:', err);
    return res.status(500).json({
      success: false,
      message: '이벤트 수정 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

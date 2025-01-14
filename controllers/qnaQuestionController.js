const jwt = require('jsonwebtoken');
const { qnaQuestion } = require('../models/QnaQuestion');
const JWT_SECRET = 'jm_shoppingmall';
const mongoose = require('mongoose');

// 질문 생성
exports.createQuestion = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(403).json({ success: false, message: 'Token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error('Token verification failed:', err);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ success: false, message: 'Token does not contain userId' });
    }

    const { title, body } = req.body;

    const question = new qnaQuestion({
      title,
      body,
      userId: decoded.userId,
    });

    const createdQuestion = await question.save();

    return res.status(200).json({
      success: true,
      question: createdQuestion,
    });
  } catch (err) {
    console.error('질문 생성 실패:', err);
    return res.status(500).json({
      success: false,
      message: '질문 생성 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

// 모든 질문 조회
exports.getAllQuestions = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    }

    jwt.verify(token, JWT_SECRET);

    const questions = await qnaQuestion.find().populate('userId', 'username');
    if (!questions || questions.length === 0) {
      return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
    }

    res.status(200).json({
      success: true,
      totalQuestions: questions.length,
      questions,
    });
  } catch (err) {
    console.error('모든 질문 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 특정 질문 조회
exports.getQuestion = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
    }

    // 토큰 검증 및 디코딩
    const decoded = jwt.verify(token, JWT_SECRET);

    // 디코딩된 토큰에서 사용자 ID 추출
    const userId = decoded.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }

    // 사용자 ID로 질문 조회
    const questions = await qnaQuestion.find({ userId }).populate('userId', 'username');
    if (!questions || questions.length === 0) {
      return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
    }

    return res.status(200).json({ success: true, questions });
  } catch (err) {
    console.error('질문 조회 중 오류:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};


// 질문 삭제
exports.deleteQuestion = async (req, res) => {
  const { id } = req.params;

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const question = await qnaQuestion.findById(id);
    if (!question) {
      return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
    }

    if (String(question.userId) !== decoded.userId) {
      return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });
    }

    await qnaQuestion.findByIdAndDelete(id);

    return res.status(200).json({ success: true, message: '질문이 삭제되었습니다.' });
  } catch (err) {
    console.error('질문 삭제 중 오류 발생:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 질문 수정
exports.updateQuestion = async (req, res) => {
  const { id } = req.params;
  const { title, body } = req.body;

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const question = await qnaQuestion.findById(id);
    if (!question) {
      return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
    }

    if (String(question.userId) !== decoded.userId) {
      return res.status(403).json({ success: false, message: '수정 권한이 없습니다.' });
    }

    question.title = title || question.title;
    question.body = body || question.body;
    question.updatedAt = Date.now();

    const updatedQuestion = await question.save();

    return res.status(200).json({ success: true, question: updatedQuestion });
  } catch (err) {
    console.error('질문 수정 중 오류 발생:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 특정 질문 ID로 조회
exports.getQuestionById = async (req, res) => {
  const { id } = req.params;

  try {
    // ID 유효성 확인
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 질문 ID입니다.',
      });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
    }

    // 토큰 검증
    jwt.verify(token, JWT_SECRET);

    // 질문 ID로 조회
    const question = await qnaQuestion.findById(id).populate('userId', 'username');
    if (!question) {
      return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
    }

    // 조회된 질문 반환
    return res.status(200).json({ success: true, question });
  } catch (err) {
    console.error('질문 ID로 조회 중 오류 발생:', err);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
    });
  }
};

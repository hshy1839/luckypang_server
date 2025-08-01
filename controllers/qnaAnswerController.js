const jwt = require('jsonwebtoken');
const { qnaQuestion } = require('../models/QnaQuestion');
const { qnaAnswer } = require('../models/QnaAnswer'); // Answer 모델 추가
const JWT_SECRET = 'jm_shoppingmall';
const mongoose = require('mongoose');

// 답변 등록
exports.addAnswer = async (req, res) => {
  const { id } = req.params; // 질문 ID
  const { body, category } = req.body; // ✅ category 추가

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

    // 질문이 존재하는지 확인
    const question = await qnaQuestion.findById(id);
    if (!question) {
      return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
    }

    // ✅ 답변 생성 (category 포함)
    const answer = new qnaAnswer({
      questionId: id,
      body,
      userId: decoded.userId,
      category, // ✅ 여기 추가
    });

    const savedAnswer = await answer.save();

    // 질문에 답변 추가
    question.answers.push(savedAnswer._id);
    await question.save();

    return res.status(200).json({
      success: true,
      message: '답변이 등록되었습니다.',
      answer: savedAnswer,
    });
  } catch (err) {
    console.error('답변 등록 중 오류 발생:', err);
    return res.status(500).json({
      success: false,
      message: '답변 등록 중 오류가 발생했습니다.',
    });
  }
};


// 질문에 연결된 답변 가져오기
exports.getAnswersByQuestionId = async (req, res) => {
  const { id } = req.params; // 질문 ID

  try {
    // 질문 ID 유효성 확인
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

    // 질문 존재 여부 확인
    const question = await qnaQuestion.findById(id);
    if (!question) {
      return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
    }

    // 질문에 연결된 답변 가져오기
    const answers = await qnaAnswer
      .find({ questionId: id })
      .populate('userId', 'username');

    return res.status(200).json({
      success: true,
      answers,
    });
  } catch (err) {
    console.error('답변 가져오기 중 오류 발생:', err);
    return res.status(500).json({
      success: false,
      message: '답변 가져오기 중 오류가 발생했습니다.',
    });
  }
};

exports.updateAnswer = async (req, res) => {
  const { answerId } = req.params;
  const { body } = req.body;

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(403).json({ success: false, message: 'Token is required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const answer = await qnaAnswer.findById(answerId);
    if (!answer) {
      return res.status(404).json({ success: false, message: '답변을 찾을 수 없습니다.' });
    }

    // 본인 확인
    if (answer.userId.toString() !== decoded.userId) {
      return res.status(403).json({ success: false, message: '수정 권한이 없습니다.' });
    }

    answer.body = body;
    await answer.save();

    return res.status(200).json({ success: true, message: '답변이 수정되었습니다.', answer });
  } catch (err) {
    console.error('답변 수정 중 오류:', err);
    return res.status(500).json({ success: false, message: '답변 수정 중 오류가 발생했습니다.' });
  }
};


exports.deleteAnswer = async (req, res) => {
  const { answerId } = req.params;

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(403).json({ success: false, message: 'Token is required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const answer = await qnaAnswer.findById(answerId);
    if (!answer) {
      return res.status(404).json({ success: false, message: '답변을 찾을 수 없습니다.' });
    }

    // 본인 확인
    if (answer.userId.toString() !== decoded.userId) {
      return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });
    }

    // 연결된 질문에서 해당 답변 ID 제거
    await qnaQuestion.updateOne(
      { _id: answer.questionId },
      { $pull: { answers: answer._id } }
    );

    // 답변 삭제
    await qnaAnswer.findByIdAndDelete(answerId);

    return res.status(200).json({ success: true, message: '답변이 삭제되었습니다.' });
  } catch (err) {
    console.error('답변 삭제 중 오류:', err);
    return res.status(500).json({ success: false, message: '답변 삭제 중 오류가 발생했습니다.' });
  }
};

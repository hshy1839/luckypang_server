const mongoose = require('mongoose');


const qnaAnswerSchema = new mongoose.Schema({
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true }, // 질문 ID (Question 모델 참조)
    body: { type: String, required: true },   // 답변 내용
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 답변 작성자 (User 모델 참조)
    createdAt: { type: Date, default: Date.now }, // 답변 작성 시간
    updatedAt: { type: Date, default: Date.now }, // 답변 업데이트 시간
  });

  const qnaAnswer = mongoose.model('Answer', qnaAnswerSchema);

  module.exports = { qnaAnswer };
const mongoose = require('mongoose');

const qnaQuestionSchema = new mongoose.Schema({
  title: { type: String, required: true },  // 질문 제목
  body: { type: String, required: true },   // 질문 내용
  category: { type: String, required: true }, // 💡 카테고리 추가
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  answers: [
    {
      answerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer' },
      createdAt: { type: Date, default: Date.now },
    }
  ],
});


  const qnaQuestion = mongoose.model('Question', qnaQuestionSchema);

module.exports = { qnaQuestion };
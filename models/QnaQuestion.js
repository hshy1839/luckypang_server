// const mongoose = require('mongoose');

// const qnaQuestionSchema = new mongoose.Schema({
//     title: { type: String, required: true },  // 질문 제목
//     body: { type: String, required: true },   // 질문 내용
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 질문 작성자 (User 모델 참조)
//     createdAt: { type: Date, default: Date.now }, // 질문 작성 시간
//     updatedAt: { type: Date, default: Date.now }, // 질문 업데이트 시간
//     answers: [
//       {
//         answerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer' }, // 답변 ID (Answer 모델 참조)
//         createdAt: { type: Date, default: Date.now },  // 답변 작성 시간
//       }
//     ],
//   });

//   const qnaQuestion = mongoose.model('Question', qnaQuestionSchema);

// module.exports = { qnaQuestion };
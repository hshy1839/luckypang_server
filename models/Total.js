const mongoose = require('mongoose');

const totalSchema = new mongoose.Schema({
  account: [
    {
      accountName: { type: String, required: true }, // 예금주
      accountNumber: { type: String, required: true }, // 계좌번호
      bankName: { type: String, required: true }, // 은행명
    },
  ],
}, { timestamps: true });

const Total = mongoose.model('Total', totalSchema);

module.exports = Total;

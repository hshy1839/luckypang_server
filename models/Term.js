const mongoose = require("mongoose");

const termSchema = mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['withdrawal', 'privacyTerm', 'serviceTerm', 'purchaseTerm', 'refundTerm'], // 카테고리 제한
  },
  content: {
    type: String,
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const Term = mongoose.model("Term", termSchema);

module.exports = { Term };

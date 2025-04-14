const mongoose = require('mongoose');


const boxPurchaseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  box: { type: mongoose.Schema.Types.ObjectId, ref: 'Box' },
  count: { type: Number, default: 1 },
  purchasedAt: { type: Date, default: Date.now },
  paymentType: { type: String, enum: ['point', 'card', 'mixed'] },
});


module.exports = mongoose.model('boxPurchase', boxPurchaseSchema);

const mongoose = require('mongoose');


const unboxingSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    box: { type: mongoose.Schema.Types.ObjectId, ref: 'Box' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // 등장한 상품
    unboxedAt: { type: Date, default: Date.now },
    actionCode: { type: String, unique: true },
  });

module.exports = mongoose.model('Unboxing', unboxingSchema);

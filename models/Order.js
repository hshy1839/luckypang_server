const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  box: { type: mongoose.Schema.Types.ObjectId, ref: 'Box', required: true },
  boxCount: { type: Number, default: 1 },

  paymentType: {
    type: String,
    enum: ['point', 'card', 'mixed'],
    required: true
  },
  paymentAmount: { type: Number, required: true },
  pointUsed: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled', 'shipped', 'refunded'],
    default: 'paid'
  },

  unboxedProduct: {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    decidedAt: Date
  },

  resultAction: {
    type: String,
    enum: ['delivery', 'refund', 'cancel'],
    default: null
  },

  refunded: {
    point: { type: Number, default: 0 },
    cash: { type: Number, default: 0 }
  },
  trackingNumber: {
    type: String,
  },
  trackingCompany: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);



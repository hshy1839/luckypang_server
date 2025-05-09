const mongoose = require('mongoose');

const shippingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipient: { type: String, required: true },
  phone: { type: String, required: true },
  memo: { type: String, default: '' },
  shippingAddress: {
    postcode: { type: String, required: true },
    address: { type: String, required: true },
    address2: { type: String, required: true },
  },
  is_default: {
    type: Boolean,
    default: false,
  },
});

const Shipping = mongoose.model('Shipping', shippingSchema);
module.exports = Shipping;

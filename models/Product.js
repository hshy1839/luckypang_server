// models/Product.js
const mongoose = require('mongoose');

const refundPolicySchema = new mongoose.Schema(
  {
    basis: { type: String, enum: ['box', 'consumer'], required: true }, // 환급 기준
    rate: { type: Number, required: true }, // % (예: 60, 70, 80)
  },
  { _id: false }
);

const productSchema = new mongoose.Schema({
  productNumber: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  brand: { type: String },
  category: { type: String },

  isVisible: { type: Boolean, default: true },
  statusDetail: { type: String, enum: ['판매중', '테스트', '품절', '비노출'], default: '판매중' },

  probability: { type: String },

  mainImage: { type: String },
  additionalImages: [{ type: String }],

  consumerPrice: { type: Number, required: true },
  price: { type: Number, required: true },
  shippingFee: { type: Number, default: 0 },
  totalPrice: { type: Number },

  // ✅ 환급 정책(자동 계산 저장)
  refundPolicy: refundPolicySchema,       // { basis: 'box'|'consumer', rate: Number }
  refundProbability: { type: Number },    // (레거시 호환) rate 값만 숫자로 저장

  description: { type: String },

  sourceLink: { type: String },
  isSourceSoldOut: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
});

const Product = mongoose.model('Product', productSchema);
module.exports = { Product };

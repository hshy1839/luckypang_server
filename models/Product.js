  const mongoose = require('mongoose');

  // 상품 스키마 정의
  const productSchema = new mongoose.Schema({
    name: { type: String, required: true },  
    brand: {type:String,},       // 상품 이름
    category: { type: String, },
    main_image: { type: String },                   // 메인 이미지 경로
    createdAt: { type: Date, default: Date.now },   // 상품 생성 날짜
    price: { type: Number, required: true },        // 가격
    description: { type: String },
    mainImage: [{ type: String }],                  // 메인 이미지 배열
    additionalImages: [{ type: String }],           // 추가 이미지 배열
  });


  // 상품 모델 생성
  const Product = mongoose.model('Product', productSchema);

  module.exports = {Product};

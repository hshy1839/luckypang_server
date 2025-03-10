  const mongoose = require('mongoose');

  // 상품 스키마 정의
  const productSchema = new mongoose.Schema({
    name: { type: String, required: true },         // 상품 이름
    category: { type: String, required: true },
    main_image: { type: String },                   // 메인 이미지 경로
    createdAt: { type: Date, default: Date.now },   // 상품 생성 날짜
    price: { type: Number, required: true },        // 가격
    description: { type: String },
    mainImage: [{ type: String }],                  // 메인 이미지 배열
    additionalImages: [{ type: String }],           // 추가 이미지 배열
    // sizeStock: {                                    // 사이즈별 재고
    //   S: { type: Number, default: 0 },
    //   M: { type: Number, default: 0 },
    //   L: { type: Number, default: 0 },
    //   XL: { type: Number, default: 0 },
    //   free: { type: Number, default: 0 },
    //   200: { type: Number, default: 0 },
    //   205: { type: Number, default: 0 },
    //   210: { type: Number, default: 0 },
    //   215: { type: Number, default: 0 },
    //   220: { type: Number, default: 0 },
    //   225: { type: Number, default: 0 },
    //   230: { type: Number, default: 0 },
    //   235: { type: Number, default: 0 },
    //   240: { type: Number, default: 0 },
    //   245: { type: Number, default: 0 },
    //   250: { type: Number, default: 0 },
    //   255: { type: Number, default: 0 },
    //   260: { type: Number, default: 0 },
    //   265: { type: Number, default: 0 },
    //   270: { type: Number, default: 0 },
    //   275: { type: Number, default: 0 },
    //   280: { type: Number, default: 0 },
    //   285: { type: Number, default: 0 },
    //   290: { type: Number, default: 0 },
    //   295: { type: Number, default: 0 },
    //   300: { type: Number, default: 0 },
    // },
  });


  // 상품 모델 생성
  const Product = mongoose.model('Product', productSchema);

  module.exports = {Product};

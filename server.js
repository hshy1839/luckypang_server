const http = require('http');
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const connectDB = require('./db');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');
const JWT_SECRET = 'jm_shoppingmall'; 

const userRoutes = require('./routes/userRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const shippingRoutes = require('./routes/shippingRoutes');
const qnaRoutes = require('./routes/qnaRoutes');
const totalRoutes = require('./routes/totalRoutes');
const couponRoutes = require('./routes/couponRoutes');
const promotionRoutes = require('./routes/promotionRoutes');


// CORS 설정 (여러 도메인 허용)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      // origin이 없거나 localhost 도메인 및 포트일 경우 허용
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true, // 인증 정보(Cookies 등)를 포함한 요청 허용
  allowedHeaders: 'Content-Type, Authorization'
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(8865, () => {
  console.log('listening to http://localhost:8865');
});

connectDB();
app.use('/api/users', userRoutes);
app.use('/api/users', noticeRoutes);
app.use('/api', productRoutes);
app.use('/api', cartRoutes);
app.use('/api', orderRoutes);
app.use('/api', shippingRoutes);
app.use('/api', qnaRoutes);
app.use('/api', totalRoutes);
app.use('/api', couponRoutes);
app.use('/api', promotionRoutes);
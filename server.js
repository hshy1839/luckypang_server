const http = require('http');
const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const connectDB = require('./db');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');
const JWT_SECRET = 'jm_shoppingmall'; 
const { Product } = require('./models/Product');

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
const boxRoutes = require('./routes/boxRoutes');


// CORS 설정 (여러 도메인 허용)
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      /^http:\/\/3\.39\.192\.73(:\d+)?$/,
      /^http:\/\/15\.165\.107\.67(:\d+)?$/,
      /^http:\/\/3\.35\.233\.121(:\d+)?$/,
      /^http:\/\/13\.125\.251\.222(:\d+)?$/,
      /^http:\/\/15\.164\.155\.205(:\d+)?$/,
      /^http:\/\/54\.180\.221\.135(:\d+)?$/,
    ];
    if (!origin || allowedOrigins.some(regex => regex.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // OPTIONS 추가
  credentials: true, // 인증 정보 포함 허용
  allowedHeaders: 'Content-Type, Authorization' // 허용된 헤더 지정
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



const port = 7778;

app.listen(port, () => {
  console.log(`listening to http://localhost:${port}`);
});

connectDB();
app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url} from ${req.ip}`);
  next();
});


app.use('/api/users', userRoutes);
app.use('/api/users', noticeRoutes);
app.use('/api', productRoutes);

app.use('/api', boxRoutes);
// app.use('/api', cartRoutes);
// app.use('/api', orderRoutes);
app.use('/api', shippingRoutes);
// app.use('/api', qnaRoutes);
app.use('/api', totalRoutes);
// app.use('/api', couponRoutes);
app.use('/api', promotionRoutes);
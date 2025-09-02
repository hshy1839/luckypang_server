const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const jwt = require('jsonwebtoken');
const connectDB = require('./db');
const bodyParser = require('body-parser');
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
const pointRoutes = require('./routes/pointRoutes');
const giftCodeRoutes = require('./routes/giftCodeRoutes');
const eventRoutes = require('./routes/eventRoutes');
const payletterRoutes = require('./routes/payletterRoutes');
const shippingOrderRoutes = require('./routes/shippingOrderRoutes');
const termRoutes = require('./routes/termRoutes');
const faqRoutes = require('./routes/faqRoutes');
const bootpayRoutes = require('./routes/bootpayRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { verifyS3Connection } = require('./aws/s3');

const app = express();

/** ====== 1) CORS 원본 체크 로직 고도화 ====== */
const allowedOrigins = [
  'http://localhost:3000',
  'https://luckytang-admin.onrender.com',
  'http://13.124.224.246:7778',
  // 필요 시 여기에 관리자/클라이언트 도메인 추가
];
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Postman 등
    const ok = allowedOrigins.includes(origin) || /\.localhost:\d+$/.test(origin);
    return ok ? cb(null, true) : cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

connectDB();

verifyS3Connection().then((ok) => {
  if (!ok) {
    console.warn('⚠️  S3 연결에 문제가 있습니다. 업로드/다운로드 기능 확인 필요');
  }
});

/** (선택) 프록시 뒤에서 IP/프로토콜 신뢰 */
app.set('trust proxy', true);

/** 요청 로깅 */
app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.originalUrl} - from ${req.ip} - proto=${req.protocol}`);
  next();
});

/** ====== 라우팅 ====== */
app.use('/api/users', userRoutes);
app.use('/api', noticeRoutes);
app.use('/api', productRoutes);
app.use('/api', shippingOrderRoutes);
app.use('/api', orderRoutes);
app.use('/api', boxRoutes);
// app.use('/api', cartRoutes);
app.use('/api', shippingRoutes);
app.use('/api', qnaRoutes);
app.use('/api', totalRoutes);
app.use('/api', couponRoutes);
app.use('/api', promotionRoutes);
app.use('/api', pointRoutes);
app.use('/api', giftCodeRoutes);
app.use('/api', eventRoutes);
app.use('/api/payletter', payletterRoutes);
app.use('/api', termRoutes);
app.use('/api', faqRoutes);
app.use('/api', bootpayRoutes);
app.use('/api', notificationRoutes);

/** ====== 2) HTTP → HTTPS 리다이렉트 (선택) ======
 * EC2 보안그룹에서 80/443 허용하는 경우 유용.
 * 포트로 접속하는 개발 단계면 생략 가능.
 */
const forceHttps = process.env.FORCE_HTTPS === 'true';
if (forceHttps) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    // X-Forwarded-Proto 고려(로드밸런서/프록시 뒤에 있을 때)
    if (req.headers['x-forwarded-proto'] === 'https') return next();
    const host = req.headers.host?.replace(/:\d+$/, ''); // 포트 제거
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });
}

/** ====== 3) 서버 기동: HTTP + HTTPS ====== */
// 포트는 환경변수로 제어
const HTTP_PORT = process.env.HTTP_PORT || 7778;
// 운영에선 443 권장(루트 권한 이슈 있으면 setcap 또는 Nginx 권장)
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

// 인증서 경로: Let's Encrypt 기본 위치 예시
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/your-domain.com/privkey.pem';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/your-domain.com/fullchain.pem';

let httpsServer;

try {
  const credentials = {
    key: fs.readFileSync(SSL_KEY_PATH, 'utf8'),
    cert: fs.readFileSync(SSL_CERT_PATH, 'utf8'),
  };
  httpsServer = https.createServer(credentials, app);
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`✅ HTTPS listening on https://0.0.0.0:${HTTPS_PORT}`);
  });
} catch (e) {
  console.warn('⚠️  HTTPS 기동 실패(인증서 확인 필요). HTTP만 실행합니다.', e.message);
}

// HTTP도 열어두되, 운영에선 80에서만 열고 HTTPS로 리다이렉트 권장
const httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, () => {
  console.log(`✅ HTTP listening on http://0.0.0.0:${HTTP_PORT}`);
});

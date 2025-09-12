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
  'http://3.34.4.223'
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
app.use('/media', require('./routes/media')); 

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

const crypto = require('crypto');


/**
 * ✅ 럭키탕 권장 기본 로직: mode='normalize'
 * - 합계가 100%가 아니어도 비율로 정규화해 1개만 뽑음 (매회 1개 보장, 설명/운영 단순)
 * ✅ 대안 로직: mode='independent'
 * - 각 상품을 절대확률(%)로 독립 판정 → 합격자 중 가중치 1픽, 무합격이면 전체 가중치 1픽
 * - 합격자 통계(무합격/다중합격) 관측 가능 (체감·설명은 다소 복잡)
 */
// function pickProductWeighted(items = [], { mode = 'normalize' } = {}) {
//   // 1) 유효 후보 필터
//   const valid = (items || [])
//     .map((it, idx) => {
//       const p = Number(it?.probability);
//       return (it && it.product && it.product._id)
//         ? { product: it.product, p: Number.isFinite(p) && p > 0 ? p : 0, idx }
//         : null;
//     })
//     .filter(Boolean);

//   if (valid.length === 0) return null;
//   if (valid.length === 1) return valid[0].product;

//   // 난수 유틸
//   const __RMAX48 = 2 ** 48 - 1; // 281,474,976,710,655
// const randFloat = (n) => (crypto.randomInt(__RMAX48) / __RMAX48) * n;

//   const weightedPick = (arr, weightKey = 'p') => {
//     const total = arr.reduce((s, v) => s + Math.max(0, v[weightKey] || 0), 0);
//     if (total <= 0) {
//       const i = crypto.randomInt(arr.length);
//       return arr[i];
//     }
//     let r = randFloat(total);
//     for (let i = 0; i < arr.length; i++) {
//       const w = Math.max(0, arr[i][weightKey] || 0);
//       if (r < w) return arr[i];
//       r -= w;
//     }
//     return arr[arr.length - 1];
//   };

//   if (mode === 'normalize') {
//     // ✅ 항상 1개 당첨, 비율로 정규화
//     const winner = weightedPick(valid, 'p');
//     return winner.product;
//   }

//   // === 'independent' 모드 ===
//   // 2) 1차: 각 항목 독립 합격 판정 (p% 절대 확률)
//   const passed = [];
//   for (const v of valid) {
//     const threshold = Math.min(v.p / 100, 1); // 100% 초과는 항상 합격
//     if (randFloat(1) < threshold) passed.push(v);
//   }

//   // 3) 합격자 중에서 최종 선택
//   if (passed.length === 1) return passed[0].product;
//   if (passed.length > 1) return weightedPick(passed, 'p').product;

//   // 4) 전원 미합격 시 백업: 전체 후보에서 p 비율로 가중 선택
//   return weightedPick(valid, 'p').product;
// }



// function runSimulation(trials = 100000) {
//   // 확률표 정의 (단위 = %)
//   const probTable = [
//     { name: '<1만원', prob: 65 },
//     { name: '1~5만원', prob: 21 },
//     { name: '5~10만원', prob: 5 },
//     { name: '10~20만원', prob: 0.29 },
//     { name: '20~30만원', prob: 0.035 },
//     { name: '30~40만원', prob: 0.01 },
//     { name: '40~50만원', prob: 0.06 },
//     { name: '50~60만원', prob: 0.02 },
//     { name: '60~70만원', prob: 0.01 },
//     { name: '70~80만원', prob: 0.005 },
//     { name: '80~90만원', prob: 0.002 },
//     { name: '90~100만원', prob: 0 },
//     { name: '100~200만원', prob: 0 },
//     { name: '200~300만원', prob: 0 },
//   ];

//   // 결과 카운트 초기화
//   const counts = {};
//   probTable.forEach(r => { counts[r.name] = 0; });

// const rand01 = () => {
//   const buf = crypto.randomBytes(6);         // 48-bit
//   const n = buf.readUIntBE(0, 6);            // 0 .. (2^48 - 1)
//   const DEN = 281_474_976_710_656;           // 2 ** 48
//   return n / DEN;                             // [0,1)
// };

//   // 시뮬레이션: 각 trial마다 모든 구간을 독립적으로 당첨 시도
//   for (let t = 0; t < trials; t++) {
//     for (const r of probTable) {
//       if (rand01() < r.prob / 100) {
//         counts[r.name]++; // 당첨 횟수 증가
//       }
//     }
//   }

//   // 결과 출력
//   console.log(`총 시도횟수: ${trials}`);
//   probTable.forEach(r => {
//     const win = counts[r.name];
//     const rate = (win / trials * 100).toFixed(3);
//     console.log(
//       `${r.name.padEnd(10)} 입력확률=${r.prob}%  ` +
//       `당첨횟수=${win}  실제당첨률=${rate}%`
//     );
//   });
// }

// // 실행
// runSimulation(100000);



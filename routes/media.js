// routes/media.js
const express = require('express');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3 } = require('../aws/s3');
const sharp = require('sharp');           // npm i sharp
const mime = require('mime');             // npm i mime

const router = express.Router();
const BUCKET = process.env.S3_BUCKET;

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// GET /media/<S3 key...>
router.get('/*', async (req, res) => {
  // 1) 키 복원 (URL 인코딩/슬래시 처리)
  const raw = req.params[0] || '';
  const key = decodeURIComponent(raw).replace(/^\/+/, '');
  if (!key) return res.status(400).send('Bad key');
  console.log('[MEDIA] key:', key);

  try {
    // 2) S3에서 객체 가져오기
    const obj = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));

    // 원본 Content-Type
    const srcType = (obj.ContentType || mime.getType(key) || 'application/octet-stream').toLowerCase();
    const isHeic = srcType.includes('heic') || key.toLowerCase().endsWith('.heic');

    // 3) 캐싱 헤더 (원하는 값으로 조정)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    if (isHeic) {
      // 4) HEIC → JPEG 변환 (sharp가 libheif 지원해야 함)
      try {
        const buf = await streamToBuffer(obj.Body);
        const out = await sharp(buf).rotate().jpeg({ quality: 85 }).toBuffer();
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', out.length);
        return res.status(200).end(out);
      } catch (e) {
        // 변환 실패 시 원본 그대로라도 내려보내기(클라에서 못 보여줄 수 있음)
        console.warn('[MEDIA] HEIC convert fail, sending original:', e?.message);
        res.setHeader('Content-Type', srcType);
        return obj.Body.pipe(res);
      }
    }

    // 5) 일반 이미지/파일은 그대로 스트리밍
    res.setHeader('Content-Type', srcType);
    return obj.Body.pipe(res);
  } catch (err) {
    console.error('[MEDIA] error:', err?.name || err?.code || err?.message);
    // NotFound, NoSuchKey 등은 404
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey') {
      return res.status(404).send('Not found');
    }
    return res.status(500).send('Server error');
  }
});

module.exports = router;

// aws/s3.js
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

const REGION = process.env.AWS_REGION;
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function verifyS3Connection() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    console.error('❌ S3_BUCKET 환경변수가 설정되어 있지 않습니다.');
    return false;
  }
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`✅ S3 연결 성공: bucket=${bucket}, region=${REGION}`);
    return true;
  } catch (e) {
    console.error('❌ S3 연결 실패:', e?.name || e?.code, e?.message);
    return false;
  }
}

// 🔴 중요: 객체로 내보내기
module.exports = { s3, verifyS3Connection };

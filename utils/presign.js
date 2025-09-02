// utils/presign.js
const { s3 } = require('../aws/s3');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET = process.env.S3_BUCKET;

async function presign(key, expiresInSec = 600) {
  if (!key) return '';
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}

module.exports = { presign };

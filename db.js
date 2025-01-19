const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    mongoose.connect('mongodb+srv://nuggiy:uNnrfEKHqxKEwBFT@cluster0s.kz9wc.mongodb.net/shopping_mall?retryWrites=true&w=majority&appName=Cluster0s', {
      
      tlsInsecure: true, // SSL/TLS 문제 해결
      family: 4,         // IPv4 강제 사용
    });
    console.log('MongoDB Atlas 연결 성공!');
  } catch (err) {
    console.error('MongoDB Atlas 연결 실패:', err);
  }
};

module.exports = connectDB;
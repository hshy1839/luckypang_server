const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    mongoose.connect(
      'mongodb+srv://Ttang:luck0317%40%21@cluster0.ybwjowo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
      {
        tlsInsecure: true,
        family: 4,
      }
    );
    console.log('MongoDB Atlas 연결 성공!');
  } catch (err) {
    console.error('MongoDB Atlas 연결 실패:', err);
  }
};

module.exports = connectDB;
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
const { checkS3Connection } = require('./s3Service');



app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  optionsSuccessStatus: 200,
}));

app.listen(8863, () => {
  console.log('listening to http://192.168.25.31:8863');
});

connectDB();
checkS3Connection();
app.use('/api/users', userRoutes);
app.use('/api/users', noticeRoutes);
app.use('/api', productRoutes);


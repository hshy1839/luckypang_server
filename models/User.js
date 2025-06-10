const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const saltRounds = 10;

const userSchema = mongoose.Schema({
  provider: {
    type: String, // 'google', 'kakao', 'apple', 'local' 등
    required: true,
    default: 'local',
  },
  user_type: {
    type: String,
    default: '3',
  },
  providerId: {
    type: String, // ex) Google UID, Kakao ID, Apple sub
    required: function () {
      return this.provider !== 'local';
    },
  },

  email: {
    type: String,
    required: function () {
      return this.provider === 'local';
    },
    unique: true,
    sparse: true, // 중복 방지 + null 허용
  },
  phoneNumber: {
    type: String,
  },
  
  password: {
    type: String,
    required: function () {
      return this.provider === 'local';
    },
  },

  nickname: { type: String, required: true },
  profileImage: { type: String },

  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});


// 비밀번호 암호화
userSchema.pre("save", function (next) {
  const user = this;
  if (user.isModified("password")) {
    bcrypt.genSalt(saltRounds, function (err, salt) {
      if (err) return next(err);
      bcrypt.hash(user.password, salt, function (err, hash) {
        if (err) return next(err);
        user.password = hash;
        next();
      });
    });
  } else {
    next();
  }
});

// 비밀번호 비교 메소드
userSchema.methods.comparePassword = function (candidatePassword) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
      if (err) return reject(err);
      resolve(isMatch);
    });
  });
};



  
const User = mongoose.model("User", userSchema);

  
module.exports = { User };

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const saltRounds = 10;

const userSchema = mongoose.Schema({
  nickname: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 8,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 5,
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    maxlength: 18,
  },
  referralCode: { type: String, unique: true }, // 이 유저의 코드
  referredBy: [{ type: String }],
  eventAgree: {
    type: Boolean,
    default: false,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  user_type: {
    type: String,
    default: "3",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  memo: {
    type: String,
  },
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

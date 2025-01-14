const mongoose = require("mongoose");
const saltRounds = 10;
const bcrypt = require("bcrypt");

const userSchema = mongoose.Schema({
    name: {
        type: String,
        maxlength: 50,
    },
    username: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
        minlength: 5,
    },
    phoneNumber: {
        type: String,
        maxlength: 12,
        unique: true,
    },
    is_active: {
        type: Boolean,
        default: false, 
    },
    user_type: {
        type: String,
        default: "3",
    },
    created_at: {
        type: Date,
        default: Date.now, // 기본값으로 생성된 날짜를 사용
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

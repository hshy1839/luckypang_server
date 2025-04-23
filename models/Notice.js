const mongoose = require("mongoose");

const noticeSchema = mongoose.Schema({
    title:
    {
        type: String,
        required: true
    },
    content:
    {
        type: String,
    },
    noticeImage: [{type: String, required: true}],
    created_at: {
        type: Date,
        default: Date.now, // 기본값으로 생성된 날짜를 사용
    },
});


const Notice = mongoose.model("Notice", noticeSchema);

module.exports = { Notice };

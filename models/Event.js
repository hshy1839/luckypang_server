const mongoose = require("mongoose");

const eventSchema = mongoose.Schema({
    title:
    {
        type: String,
        required: true
    },
    content:
    {
        type: String,
    },
    eventImage: [{type: String, required: true}],
    created_at: {
        type: Date,
        default: Date.now, // 기본값으로 생성된 날짜를 사용
    },
});


const Event = mongoose.model("Event", eventSchema);

module.exports = { Event };

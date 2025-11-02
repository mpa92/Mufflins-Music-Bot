const mongoose = require('mongoose');

const musicCardSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
    },
    musicCardEnabled: {
        type: Boolean,
        default: false, 
    },
});

module.exports = mongoose.model('MusicCard', musicCardSchema);


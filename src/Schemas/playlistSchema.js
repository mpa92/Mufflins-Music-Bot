const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    name: { type: String, required: true },
    tracks: [{
        title: String,
        uri: String,
        author: String,
        duration: Number,
        thumbnail: String
    }],
    createdAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
});

// Compound index to ensure user can't create multiple playlists with same name
playlistSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.models.Playlist || mongoose.model('Playlist', playlistSchema);


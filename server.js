const express = require('express');
const path = require('path');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Load environment variables
const BOT_TOKEN = process.env.TOKEN;
if (!BOT_TOKEN) {
    console.error('Bot token not found in environment variables!');
}

// Enable CORS
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'src/dashboard')));

let botClient = null;

// Function to set the bot client (called from index.js)
function setBotClient(client) {
    botClient = client;
    console.log('✅ Bot client set in server.js');
}

// Function to get the bot client
function getClient() {
    return botClient;
}

module.exports = { setBotClient, getClient };

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        bot: botClient ? 'connected' : 'disconnected',
        uptime: process.uptime()
    });
});

// Get bot stats
app.get('/api/stats', (req, res) => {
    if (!botClient) {
        return res.status(503).json({ error: 'Bot not connected' });
    }

    res.json({
        guilds: botClient.guilds.cache.size,
        users: botClient.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
        uptime: process.uptime(),
        username: botClient.user.tag
    });
});

// Get player info for a guild
app.get('/api/player/:guildId', (req, res) => {
    if (!botClient) {
        return res.status(503).json({ error: 'Bot not connected' });
    }

    const { guildId } = req.params;
    const player = botClient.manager.players.get(guildId);

    if (!player) {
        return res.json({ playing: false });
    }

    const current = player.queue.current;
    
    res.json({
        playing: player.playing,
        paused: player.paused,
        volume: player.volume,
        loop: player.loop,
        queueSize: player.queue.size,
        current: current ? {
            title: current.title,
            author: current.author,
            duration: current.length,
            uri: current.uri,
            thumbnail: current.thumbnail
        } : null
    });
});

// Voice channel status endpoint
app.get('/api/voice-status/:guildId/:userId', async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        if (!guildId || !userId) {
            return res.status(400).json({ error: 'Guild ID and User ID are required' });
        }

        const client = getClient();
        if (!client) {
            return res.status(500).json({ error: 'Bot client not available' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }

        let member;
        try {
            member = await guild.members.fetch(userId);
        } catch (fetchError) {
            console.error('Failed to fetch member:', fetchError);
            return res.status(404).json({ error: 'Member not found in guild' });
        }

        const voiceChannel = member.voice.channel;
        res.json({
            inVoiceChannel: !!voiceChannel,
            channelId: voiceChannel?.id,
            channelName: voiceChannel?.name
        });
    } catch (error) {
        console.error('Voice status error:', error);
        res.status(500).json({ error: 'Failed to get voice status' });
    }
});

// Search endpoint
app.get('/api/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        const client = getClient();
        if (!client) {
            return res.status(500).json({ error: 'Bot client not available' });
        }

        const results = await client.manager.search(query);
        
        if (!results || !results.tracks || results.tracks.length === 0) {
            return res.json({ tracks: [] });
        }

        const tracks = results.tracks.slice(0, 10).map(track => ({
            title: track.title,
            author: track.author,
            duration: track.duration,
            thumbnail: track.thumbnail,
            uri: track.uri
        }));

        res.json({ tracks });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ 
            error: 'Failed to search tracks', 
            details: error.message
        });
    }
});

// Play endpoint
app.post('/api/play', async (req, res) => {
    try {
        const { guildId, track, voiceChannelId } = req.body;
        if (!guildId || !track || !voiceChannelId) {
            return res.status(400).json({ error: 'Guild ID, track, and voice channel ID are required' });
        }

        const client = getClient();
        if (!client) {
            return res.status(500).json({ error: 'Bot client not available' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }

        const voiceChannel = guild.channels.cache.get(voiceChannelId);
        if (!voiceChannel) {
            return res.status(404).json({ error: 'Voice channel not found' });
        }

        let player = client.manager.players.get(guildId);

        if (!player || player.voiceId !== voiceChannelId) {
            if (player) {
                player.destroy();
            }

            player = await client.manager.createPlayer({
                guildId: guildId,
                textId: guild.channels.cache.find(c => c.type === 0)?.id,
                voiceId: voiceChannelId,
                volume: 100,
                deaf: true
            });
        }

        const searchQuery = track.uri || track.title;
        const result = await player.search(searchQuery, { requester: null });
        
        if (!result || !result.tracks || result.tracks.length === 0) {
            return res.status(404).json({ error: 'Track not found' });
        }

        const searchedTrack = result.tracks[0];
        
        const safeTrack = {
            title: searchedTrack.title,
            uri: searchedTrack.uri,
            duration: searchedTrack.duration,
            thumbnail: searchedTrack.thumbnail,
            author: searchedTrack.author
        };

        if (player.queue.length === 0 && !player.playing && !player.paused) {
            player.play(searchedTrack);
            res.json({ status: 'playing', track: safeTrack });
        } else {
            player.queue.add(searchedTrack);
            res.json({ status: 'queued', track: safeTrack });
        }
    } catch (error) {
        console.error('Play error:', error);
        res.status(500).json({ error: 'Failed to play track', details: error.message });
    }
});

// Player control endpoints
app.post('/api/player/toggle', async (req, res) => {
    try {
        const { guildId } = req.body;
        const client = getClient();
        const player = client.manager.players.get(guildId);

        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        player.pause(!player.paused);
        res.json({ paused: player.paused });
    } catch (error) {
        console.error('Toggle error:', error);
        res.status(500).json({ error: 'Failed to toggle playback' });
    }
});

app.post('/api/player/skip', async (req, res) => {
    try {
        const { guildId } = req.body;
        const client = getClient();
        const player = client.manager.players.get(guildId);

        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        player.skip();
        res.json({ success: true });
    } catch (error) {
        console.error('Skip error:', error);
        res.status(500).json({ error: 'Failed to skip track' });
    }
});

app.post('/api/player/volume', async (req, res) => {
    try {
        const { guildId, volume } = req.body;
        const client = getClient();
        const player = client.manager.players.get(guildId);

        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        player.setVolume(volume);
        res.json({ volume: player.volume });
    } catch (error) {
        console.error('Volume error:', error);
        res.status(500).json({ error: 'Failed to update volume' });
    }
});

// Get queue
app.get('/api/queue/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        const client = getClient();
        if (!client) {
            return res.status(500).json({ error: 'Bot client not available' });
        }

        const player = client.manager.players.get(guildId);
        if (!player) {
            return res.json({ queue: [], currentTrack: null });
        }

        const queue = player.queue.map(track => ({
            title: track.title,
            author: track.author,
            duration: track.duration,
            thumbnail: track.thumbnail,
            uri: track.uri
        }));

        res.json({ 
            queue,
            currentTrack: player.queue.current ? {
                title: player.queue.current.title,
                author: player.queue.current.author,
                duration: player.queue.current.duration,
                thumbnail: player.queue.current.thumbnail,
                uri: player.queue.current.uri
            } : null
        });
    } catch (error) {
        console.error('Get queue error:', error);
        res.status(500).json({ error: 'Failed to get queue' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Express Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
    console.log(`🌐 Web server is running on port ${port}`);
    console.log(`📊 Dashboard: http://localhost:${port}`);
});

module.exports.app = app;


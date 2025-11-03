const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const { Connectors } = require("shoukaku");
const { Kazagumo, Plugins } = require("kazagumo");
const KazagumoFilter = require('kazagumo-filter');
const config = require('../config.json');
const { setBotClient } = require('../server.js');
require('dotenv').config();

// Prefix for commands
const PREFIX = 'mm!';

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Lavalink nodes configuration (supports both env vars and config.json)
const isSecure = process.env.LAVALINK_SECURE !== undefined ? 
    process.env.LAVALINK_SECURE === 'true' : 
    config.lavalink.secure;

const lavalinkHost = process.env.LAVALINK_HOST || config.lavalink.host;
const lavalinkPort = process.env.LAVALINK_PORT || config.lavalink.port;

// Railway requires explicit port even for HTTPS - always include port in URL
const lavalinkUrl = `${lavalinkHost}:${lavalinkPort}`;

const Nodes = [{
    name: process.env.LAVALINK_NAME || 'Mufflins-Lavalink',
    url: lavalinkUrl,
    auth: process.env.LAVALINK_PASSWORD || config.lavalink.password,
    secure: isSecure
}];

console.log(`🔗 Connecting to Lavalink: ${Nodes[0].url} (secure: ${Nodes[0].secure})`);
console.log(`📋 Connection details: host=${lavalinkHost}, port=${lavalinkPort}, secure=${isSecure}`);

// Initialize Kazagumo music manager
client.manager = new Kazagumo({
    defaultSearchEngine: 'youtube',
    plugins: [new Plugins.PlayerMoved(client), new KazagumoFilter()],
    send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    }
}, new Connectors.DiscordJS(client), Nodes);

// Connection tracking variables
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Manager ready event - handles both initial connection and reconnections
client.manager.shoukaku.on('ready', (name) => {
    console.log(`✅ Lavalink node "${name}" connected and ready`);
    if (reconnectAttempts > 0) {
        console.log(`✅ Reconnection successful after ${reconnectAttempts} attempt(s)`);
        reconnectAttempts = 0; // Reset counter on successful connection
    }
    client.managerReady = true;
});

client.manager.shoukaku.on('error', (name, error) => {
    console.error(`❌ Lavalink node "${name}" error:`, error?.message || error || 'Unknown error');
});

client.manager.shoukaku.on('close', (name, code, reason) => {
    // Code 1006 is common on Railway due to proxy timeouts - this is expected behavior
    // Shoukaku auto-reconnects, so these warnings are informational only
    if (code === 1006) {
        reconnectAttempts++;
        // Only log every 5th disconnection to reduce log noise (unless it's a critical count)
        if (reconnectAttempts % 5 === 0 || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.warn(`⚠️ Lavalink node "${name}" closed (1006) - Railway proxy timeout. Auto-reconnecting... (${reconnectAttempts} total)`);
            
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.error(`❌ Frequent disconnections detected (${reconnectAttempts}). This is common on Railway. Bot will continue to reconnect.`);
            }
        }
    } else {
        // Log other close codes (not 1006) with full details
        console.warn(`⚠️ Lavalink node "${name}" closed. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    }
    
    client.managerReady = false;
});

client.manager.shoukaku.on('disconnect', (name, count) => {
    console.warn(`⚠️ Lavalink node "${name}" disconnected. Count: ${count}`);
    client.managerReady = false;
});

// Initialize prefix commands collection
client.prefixCommands = new Map();

// Load function handlers
const functions = fs.readdirSync("./src/functions").filter(file => file.endsWith(".js"));
const eventFiles = fs.readdirSync("./src/events").filter(file => file.endsWith(".js"));
const prefixCommandFolders = fs.readdirSync("./src/prefix");

// Button interactions removed - all functionality now uses text commands only

// Load all handlers
(async () => {
    for (const file of functions) {
        require(`./functions/${file}`)(client);
    }
    client.handleEvents(eventFiles, "./src/events");
    
    // Wait for client to be ready before handling commands
    client.once('ready', () => {
        console.log(`✅ Bot is online as ${client.user.tag}`);
        console.log(`🎵 Serving ${client.guilds.cache.size} guilds`);
        console.log(`🎮 Prefix: mm!`);
        client.handlePrefixCommands(prefixCommandFolders, "./src/prefix");
        
        // Set bot client in server.js for API access
        setBotClient(client);
    });
    
    // Check if token exists before attempting login
    if (!process.env.TOKEN) {
        console.error('❌ Bot token not found in environment variables!');
        console.error('📝 Please set the TOKEN variable in Railway:');
        console.error('   1. Go to your service → Variables tab');
        console.error('   2. Add: TOKEN=your_discord_bot_token');
        console.error('   3. Redeploy the service');
        process.exit(1);
    }
    
    await client.login(process.env.TOKEN);
})();

// Prefix command handler
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    // Case-insensitive prefix check - accepts mm!, Mm!, mM!, MM!
    const contentLower = message.content.toLowerCase();
    if (!contentLower.startsWith(PREFIX.toLowerCase())) return;

    // Slice using actual prefix length (always 3 for "mm!")
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.prefixCommands?.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args, client);
    } catch (error) {
        console.error('Prefix Command Error:', error);
        message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setDescription('`❌` | **An error occurred while executing this command!**')
                    .setFooter({ text: 'Please try again later' })
            ]
        }).catch(() => {});
    }
});

// Kazagumo player events
client.manager.on('playerStart', (player, track) => {
    const playerStartEvent = require('./events/playerStart');
    playerStartEvent(client, player, track);
});

client.manager.on('playerEmpty', (player) => {
    const playerEmptyEvent = require('./events/playerEmpty');
    playerEmptyEvent(client, player);
});

client.manager.on('playerEnd', (player) => {
    const playerEndEvent = require('./events/playerEnd');
    playerEndEvent(client, player);
});

// Track position tracking to detect truly stuck tracks
const playerPositions = new Map(); // guildId -> { lastPosition, lastCheck, stuckCount }

// Periodic check for stuck tracks (every 45 seconds - conservative approach)
// Only intervenes if track position hasn't changed AND player reports not playing
setInterval(() => {
    if (!client.managerReady) return;

    client.manager.players.forEach(async (player) => {
        if (!player || !player.queue.current) {
            playerPositions.delete(player.guildId);
            return;
        }
        
        // Skip if paused
        if (player.paused) {
            playerPositions.delete(player.guildId);
            return;
        }
        
        const currentTrack = player.queue.current;
        const currentPosition = player.position || 0;
        const trackLength = currentTrack.length || 0;
        
        // Skip if track is near the end (within 3 seconds) - it's finishing normally
        if (trackLength > 0 && currentPosition >= trackLength - 3000) {
            playerPositions.delete(player.guildId);
            return;
        }
        
        // Skip if track just started (less than 5 seconds in)
        if (currentPosition < 5000) {
            playerPositions.delete(player.guildId);
            return;
        }
        
        const lastCheck = playerPositions.get(player.guildId);
        const now = Date.now();
        
        // If player reports it's playing, assume everything is fine
        if (player.playing) {
            playerPositions.set(player.guildId, {
                lastPosition: currentPosition,
                lastCheck: now,
                stuckCount: 0
            });
            return;
        }
        
        // Player reports NOT playing - check if position has changed
        if (lastCheck) {
            const timeSinceLastCheck = now - lastCheck.lastCheck;
            const positionChanged = Math.abs(currentPosition - lastCheck.lastPosition) > 2000; // More than 2 seconds change
            
            // If position advanced, track is actually playing fine
            if (positionChanged) {
                playerPositions.set(player.guildId, {
                    lastPosition: currentPosition,
                    lastCheck: now,
                    stuckCount: 0
                });
                return;
            }
            
            // Position hasn't changed AND player reports not playing
            // Only intervene after 3 consecutive checks (135+ seconds of being stuck)
            const newStuckCount = lastCheck.stuckCount + 1;
            
            if (newStuckCount >= 3 && timeSinceLastCheck > 40000) {
                console.warn(`[${player.guildId}] Track "${currentTrack.title}" is stuck (position: ${Math.floor(currentPosition/1000)}s) - attempting recovery`);
                
                try {
                    await player.play();
                    console.log(`[${player.guildId}] ✅ Resumed playback`);
                    playerPositions.delete(player.guildId);
                } catch (err) {
                    console.error(`[${player.guildId}] ❌ Resume failed:`, err?.message || err);
                    playerPositions.delete(player.guildId); // Give up after one attempt
                }
                return;
            }
            
            // Update stuck count
            playerPositions.set(player.guildId, {
                lastPosition: currentPosition,
                lastCheck: now,
                stuckCount: newStuckCount
            });
        } else {
            // First check - just record position
            playerPositions.set(player.guildId, {
                lastPosition: currentPosition,
                lastCheck: now,
                stuckCount: 0
            });
        }
    });
}, 45000); // Check every 45 seconds (less aggressive)

// Handle player errors/exceptions
client.manager.shoukaku.on('error', (name, error) => {
    console.error(`❌ Lavalink node "${name}" error:`, error?.message || error || 'Unknown error');
});

// Handle player exceptions (track errors)
client.manager.on('playerException', (player, track, error) => {
    console.error(`[${player.guildId}] Track exception:`, track?.title || 'Unknown');
    console.error(`[${player.guildId}] Error:`, error?.message || error || 'Unknown error');
    
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
        const errorMsg = error?.message || error?.toString() || '';
        const errorStr = errorMsg.toLowerCase();
        
        // Handle YouTube script parsing errors (deprecated source failing)
        if (errorStr.includes('must find action functions from script') || 
            errorStr.includes('problematic youtube player script') ||
            errorStr.includes('youtube signature cipher')) {
            const trackInfo = track?.title && track?.author ? `${track.author} ${track.title}` : (track?.title || 'this track');
            channel.send({
                embeds: [{
                    color: 0x8e7cc3,
                    description: `\`⚠️\` | **YouTube track failed to load**\n\nThis may be due to YouTube's player script changes.\n\n**Try searching instead:**\n\`mm!play ${trackInfo}\``
                }]
            }).catch(() => {});
        }
        // Handle Spotify/Youtube mirroring errors (400, 401, 403) - auto-retry with SoundCloud
        else if (errorStr.includes('invalid status code') && (errorStr.includes('400') || errorStr.includes('401') || errorStr.includes('403'))) {
            // Check if this is a Spotify track that failed
            if (track?.uri && track.uri.includes('spotify.com')) {
                const trackInfo = track?.title && track?.author ? `${track.author} ${track.title}` : (track?.title || 'this track');
                
                // Auto-retry with SoundCloud search
                channel.send({
                    embeds: [{
                        color: 0x8e7cc3,
                        description: `\`⚠️\` | **YouTube mirroring failed, trying SoundCloud...**\n\nTrack: ${trackInfo}`
                    }]
                }).catch(() => {});
                
                // Try to find and play from SoundCloud
                setTimeout(async () => {
                    try {
                        const scResult = await player.search(`scsearch:${trackInfo}`, { id: 'auto-retry' });
                        if (scResult.tracks.length > 0) {
                            const scTrack = scResult.tracks[0];
                            scTrack.requester = { id: 'system' };
                            player.queue.unshift(scTrack); // Add to front of queue
                            await player.play();
                            channel.send({
                                embeds: [{
                                    color: 0x8e7cc3,
                                    description: `\`✅\` | **Playing from SoundCloud:** ${scTrack.title}`
                                }]
                            }).catch(() => {});
                        } else {
                            channel.send({
                                embeds: [{
                                    color: 0x8e7cc3,
                                    description: `\`❌\` | **SoundCloud search failed too**\n\nTry: \`mm!play ${trackInfo}\``
                                }]
                            }).catch(() => {});
                        }
                    } catch (retryError) {
                        console.error(`[${player.guildId}] SoundCloud retry error:`, retryError);
                    }
                }, 500);
            } else {
                const trackInfo = track?.title && track?.author ? `${track.author} ${track.title}` : (track?.title || 'this track');
                channel.send({
                    embeds: [{
                        color: 0x8e7cc3,
                        description: `\`❌\` | **Failed to play track**\n\nTry searching by name:\n\`mm!play ${trackInfo}\``
                    }]
                }).catch(() => {});
            }
        } else if (errorStr.includes('please sign in') || errorStr.includes('requires login') || errorStr.includes('sign in')) {
            const trackInfo = track?.title && track?.author ? `${track.author} ${track.title}` : (track?.title || 'this track');
            channel.send({
                embeds: [{
                    color: 0x8e7cc3,
                    description: `\`❌\` | **Failed to play: ${track?.title || 'Unknown track'}**\n\nYouTube requires authentication for this video.\nTry searching by name instead: \`mm!play ${trackInfo}\``
                }]
            }).catch(() => {});
        } else {
            channel.send({
                embeds: [{
                    color: 0x8e7cc3,
                    description: `\`❌\` | **Failed to play: ${track?.title || 'Unknown track'}**\n\nError: ${errorMsg.substring(0, 200)}`
                }]
            }).catch(() => {});
        }
    }
    
    // Try to skip to next track if available
    // IMPORTANT: Only skip if queue actually has tracks (prevent accidental queue clearing)
    if (player.queue.size > 0 && player.queue.current) {
        setTimeout(async () => {
            // Double-check queue still has tracks before trying to play
            if (player.queue.size > 0 && !player.playing && player.queue.current) {
                try {
                    await player.play();
                    console.log(`[${player.guildId}] Successfully played next track after exception`);
                } catch (err) {
                    console.error(`[${player.guildId}] Error playing next track after exception:`, err.message);
                    // If play fails, try skip instead but ONLY if queue has more tracks
                    if (player.queue.size > 1) {
                        console.log(`[${player.guildId}] Attempting to skip to next track (${player.queue.size - 1} remaining)`);
                        player.skip();
                    } else {
                        console.warn(`[${player.guildId}] Cannot skip - only 1 track remaining and play failed`);
                    }
                }
            }
        }, 1000);
    } else {
        console.warn(`[${player.guildId}] Track exception - queue is empty or no current track`);
    }
});

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

console.log('🎵 Mufflins Music Bot is starting...');

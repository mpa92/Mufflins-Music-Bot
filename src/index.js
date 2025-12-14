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
        console.log(`🆔 Bot Client ID: ${client.user.id}`);
        console.log(`🔗 Invite Link: https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=36703232&scope=bot%20applications.commands`);
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

// Track start times for detecting instant failures
const trackStartTimes = new Map(); // guildId -> { track, startTime, hasRetried }

// Auto-disconnect timers - tracks inactivity timers per guild
const autoDisconnectTimers = new Map(); // guildId -> { timeout, interval, startTime }
const IDLE_DISCONNECT_TIME = 2.5 * 60 * 1000; // 2 minutes 30 seconds in milliseconds

// Function to clear auto-disconnect timer for a guild
function clearAutoDisconnectTimer(guildId) {
    const timerData = autoDisconnectTimers.get(guildId);
    if (timerData) {
        if (timerData.timeout) {
            clearTimeout(timerData.timeout);
        }
        if (timerData.interval) {
            clearInterval(timerData.interval);
        }
        autoDisconnectTimers.delete(guildId);
    }
}

// Make functions accessible to commands
client.clearAutoDisconnectTimer = clearAutoDisconnectTimer;
client.startAutoDisconnectTimer = startAutoDisconnectTimer;

// Function to start auto-disconnect timer (2 minutes 30 seconds of inactivity)
function startAutoDisconnectTimer(guildId) {
    // Clear any existing timer first
    clearAutoDisconnectTimer(guildId);
    
    const startTime = Date.now();
    let lastDisplayedTime = -1;
    
    // Start countdown interval (update every 30 seconds)
    const interval = setInterval(() => {
        const player = client.manager.players.get(guildId);
        if (!player) {
            clearAutoDisconnectTimer(guildId);
            return;
        }
        
        // Check if music is playing or paused - if so, stop countdown
        if (player.playing || player.paused || player.queue.size > 0) {
            clearAutoDisconnectTimer(guildId);
            return;
        }
        
        const elapsed = Date.now() - startTime;
        const remaining = IDLE_DISCONNECT_TIME - elapsed;
        const remainingSeconds = Math.ceil(remaining / 1000);
        
        // Only log every 30 seconds to avoid spam
        const displayTime = Math.floor(remainingSeconds / 30) * 30;
        if (displayTime !== lastDisplayedTime && remainingSeconds > 0) {
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            const guild = client.guilds.cache.get(guildId);
            const guildName = guild ? guild.name : guildId;
            console.log(`[${guildName}] ⏱️  Auto-disconnect countdown: ${minutes}:${seconds.toString().padStart(2, '0')} remaining (not playing)`);
            lastDisplayedTime = displayTime;
        }
    }, 30000); // Update every 30 seconds
    
    // Start new 2 minute 30 second timer
    const timeout = setTimeout(async () => {
        try {
            const player = client.manager.players.get(guildId);
            if (!player) {
                clearAutoDisconnectTimer(guildId);
                return;
            }
            
            // Check if music is actually playing
            if (player.playing || player.paused) {
                // Music is playing/paused, don't disconnect - restart timer
                startAutoDisconnectTimer(guildId);
                return;
            }
            
            // Check if there are tracks in queue
            if (player.queue.size > 0) {
                // Queue has tracks, don't disconnect - restart timer
                startAutoDisconnectTimer(guildId);
                return;
            }
            
            // Clear the interval before disconnecting
            clearAutoDisconnectTimer(guildId);
            
            // No music playing and no queue - disconnect
            const channel = client.channels.cache.get(player.textId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setDescription('No tracks have been playing for the past 2 minutes 30 seconds, leaving :wave:');
                
                await channel.send({ embeds: [embed] }).catch(() => {});
            }
            
            // Disconnect the player
            await player.destroy();
            
            const guild = client.guilds.cache.get(guildId);
            const guildName = guild ? guild.name : guildId;
            console.log(`[${guildName}] ✅ Auto-disconnected after 2 minutes 30 seconds of inactivity`);
        } catch (error) {
            console.error(`[${guildId}] Error during auto-disconnect:`, error);
            clearAutoDisconnectTimer(guildId);
        }
    }, IDLE_DISCONNECT_TIME);
    
    autoDisconnectTimers.set(guildId, { timeout, interval, startTime });
    
    // Log initial countdown start
    const guild = client.guilds.cache.get(guildId);
    const guildName = guild ? guild.name : guildId;
    console.log(`[${guildName}] ⏱️  Auto-disconnect countdown started: 2:30 remaining (not playing)`);
}
// Kazagumo player events
client.manager.on('playerStart', (player, track) => {
    // Record when track started
    trackStartTimes.set(player.guildId, {
        track: track,
        startTime: Date.now(),
        hasRetried: false
    });
    
    // Clear auto-disconnect timer when music starts
    clearAutoDisconnectTimer(player.guildId);
    
    const playerStartEvent = require('./events/playerStart');
    playerStartEvent(client, player, track);
});

client.manager.on('playerEmpty', (player) => {
    trackStartTimes.delete(player.guildId);
    
    // Start auto-disconnect timer when queue becomes empty
    // Only if not playing and no autoplay
    if (!player.playing && !player.paused) {
        const autoplayEnabled = player.data.get("autoplay");
        if (!autoplayEnabled) {
            startAutoDisconnectTimer(player.guildId);
        }
    }
    
    const playerEmptyEvent = require('./events/playerEmpty');
    playerEmptyEvent(client, player);
});

client.manager.on('playerEnd', async (player) => {
    const playerEndEvent = require('./events/playerEnd');
    playerEndEvent(client, player);
    
    // Get the track that just ended for retry logic
    const trackInfo = trackStartTimes.get(player.guildId);
    const endedTrack = trackInfo?.track || player.queue.previous || player.queue.current;
    
    // Check if track ended too quickly - indicates stream failure (only for Spotify tracks)
    if (trackInfo && !trackInfo.hasRetried && endedTrack) {
        const playDuration = Date.now() - trackInfo.startTime;
        const track = trackInfo.track;
        
        // Only check for premature ending if it's a Spotify track
        const isSpotifyTrack = track?.uri && track.uri.includes('spotify.com');
        
        if (isSpotifyTrack && track.length > 10000) {
            const percentagePlayed = (playDuration / track.length) * 100;
            console.log(`[${player.guildId}] 📊 Spotify track play duration: ${playDuration}ms (expected: ${track.length}ms, ${percentagePlayed.toFixed(1)}%)`);
            
            // More strict threshold for Spotify - only retry if less than 50% played (indicates real failure)
            // This prevents false positives from tracks that end normally
            if (percentagePlayed < 50 && playDuration < 30000) {
                console.warn(`[${player.guildId}] ⚠️  Spotify track ended prematurely (${playDuration}ms / expected ${track.length}ms, only ${percentagePlayed.toFixed(1)}% played)`);
                
                const channel = client.channels.cache.get(player.textId);
                if (channel) {
                    console.log(`[${player.guildId}] 🔄 Auto-retrying Spotify track with YouTube search...`);
                    
                    const { EmbedBuilder } = require('discord.js');
                    channel.send({
                        embeds: [new EmbedBuilder()
                            .setColor(0x8e7cc3)
                            .setDescription(`\`⚠️\` | **Spotify stream failed, retrying with YouTube...**\n\nTrack: ${track.author} - ${track.title}`)
                        ]
                    }).catch(() => {});
                    
                    // Mark as retried to prevent infinite loop
                    trackInfo.hasRetried = true;
                    
                    // Search YouTube and play
                    setTimeout(async () => {
                        try {
                            const searchQuery = `${track.author} ${track.title}`;
                            const result = await player.search(searchQuery, { requester: track.requester || { id: 'system' } });
                            
                            if (result.tracks.length > 0) {
                                const ytTrack = result.tracks[0];
                                ytTrack.requester = track.requester || { id: 'system' };
                                
                                // Add to front of queue if queue is empty, otherwise add after current
                                if (player.queue.size === 0) {
                                    player.queue.add(ytTrack);
                                } else {
                                    player.queue.unshift(ytTrack);
                                }
                                
                                // Only play if not already playing
                                if (!player.playing && !player.paused) {
                                    await player.play();
                                }
                                
                                console.log(`[${player.guildId}] ✅ Retrying with YouTube: ${ytTrack.title}`);
                                channel.send({
                                    embeds: [new EmbedBuilder()
                                        .setColor(0x8e7cc3)
                                        .setDescription(`\`✅\` | **Now playing from YouTube:** ${ytTrack.title}`)
                                    ]
                                }).catch(() => {});
                            } else {
                                console.error(`[${player.guildId}] ❌ YouTube search failed for: ${searchQuery}`);
                                channel.send({
                                    embeds: [new EmbedBuilder()
                                        .setColor(0x8e7cc3)
                                        .setDescription(`\`❌\` | **Failed to find track on YouTube**\n\nTry: \`mm!play ${searchQuery}\``)
                                    ]
                                }).catch(() => {});
                            }
                        } catch (err) {
                            console.error(`[${player.guildId}] ❌ Retry error:`, err);
                        }
                    }, 500);
                    
                    // Clean up track info after retry
                    setTimeout(() => {
                        trackStartTimes.delete(player.guildId);
                    }, 5000);
                    return; // Exit early to prevent normal queue advancement interference
                }
            }
        }
    }
    
    // Ensure queue advancement when loop is off
    // Kazagumo should handle this automatically, but we'll ensure it happens
    if (player.loop === 'none' && player.queue.size > 0 && !player.playing && !player.paused) {
        // Small delay to ensure track is fully ended before playing next
        setTimeout(async () => {
            try {
                // Double-check conditions before playing
                if (player.queue.size > 0 && !player.playing && !player.paused && player.loop === 'none') {
                    console.log(`[${player.guildId}] ▶️  Auto-advancing to next track in queue (${player.queue.size} remaining)`);
                    await player.play();
                }
            } catch (error) {
                console.error(`[${player.guildId}] ❌ Error auto-advancing queue:`, error?.message || error);
            }
        }, 300);
    }
    
    // Check if we should start auto-disconnect timer
    // Only if queue is empty, not playing, and no autoplay
    if (player.queue.size === 0 && !player.playing && !player.paused) {
        const autoplayEnabled = player.data.get("autoplay");
        if (!autoplayEnabled) {
            startAutoDisconnectTimer(player.guildId);
        }
    }
    
    // Clean up track info after a delay (if not already cleaned up)
    setTimeout(() => {
        trackStartTimes.delete(player.guildId);
    }, 10000);
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
        // Handle Spotify/Youtube mirroring errors (400, 401, 403) - auto-retry with YouTube search
        else if (errorStr.includes('invalid status code') && (errorStr.includes('400') || errorStr.includes('401') || errorStr.includes('403'))) {
            // Check if this is a Spotify track that failed
            if (track?.uri && track.uri.includes('spotify.com')) {
                const trackInfo = track?.title && track?.author ? `${track.author} ${track.title}` : (track?.title || 'this track');
                
                // Check if we've already retried this track to prevent infinite loops
                const retryKey = `${player.guildId}_${track.identifier || track.uri}`;
                if (player.data.get(`retry_${retryKey}`)) {
                    console.log(`[${player.guildId}] Already retried this Spotify track, skipping auto-retry`);
                    channel.send({
                        embeds: [{
                            color: 0x8e7cc3,
                            description: `\`❌\` | **Failed to play Spotify track**\n\nTrack: ${trackInfo}\n\nTry: \`mm!play ${trackInfo}\``
                        }]
                    }).catch(() => {});
                    return;
                }
                
                // Mark as retried
                player.data.set(`retry_${retryKey}`, true);
                setTimeout(() => player.data.delete(`retry_${retryKey}`), 60000); // Clear after 1 minute
                
                // Auto-retry with YouTube search (more reliable than SoundCloud)
                channel.send({
                    embeds: [{
                        color: 0x8e7cc3,
                        description: `\`⚠️\` | **Spotify track failed, trying YouTube...**\n\nTrack: ${trackInfo}`
                    }]
                }).catch(() => {});
                
                // Try to find and play from YouTube
                setTimeout(async () => {
                    try {
                        const searchQuery = trackInfo;
                        const ytResult = await player.search(`ytsearch:${searchQuery}`, { requester: track.requester || { id: 'system' } });
                        if (ytResult.tracks.length > 0) {
                            const ytTrack = ytResult.tracks[0];
                            ytTrack.requester = track.requester || { id: 'system' };
                            
                            // Add to front of queue if queue is empty, otherwise add after current
                            if (player.queue.size === 0) {
                                player.queue.add(ytTrack);
                            } else {
                                player.queue.unshift(ytTrack);
                            }
                            
                            // Only play if not already playing
                            if (!player.playing && !player.paused) {
                                await player.play();
                            }
                            
                            channel.send({
                                embeds: [{
                                    color: 0x8e7cc3,
                                    description: `\`✅\` | **Playing from YouTube:** ${ytTrack.title}`
                                }]
                            }).catch(() => {});
                        } else {
                            channel.send({
                                embeds: [{
                                    color: 0x8e7cc3,
                                    description: `\`❌\` | **YouTube search failed**\n\nTry: \`mm!play ${trackInfo}\``
                                }]
                            }).catch(() => {});
                        }
                    } catch (retryError) {
                        console.error(`[${player.guildId}] YouTube retry error:`, retryError);
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
    
    // Kazagumo will automatically try to play the next track
    // We just log the queue status here
    if (player.queue.size > 0) {
        console.log(`[${player.guildId}] ⏭️  Queue has ${player.queue.size} tracks - Kazagumo will auto-play next track`);
    } else {
        console.warn(`[${player.guildId}] ⚠️  Track exception - queue is empty`);
    }
});

// Listen for player destruction (when player.destroy() is called)
// This happens when user uses leave/stop commands or bot disconnects
client.manager.on('playerDestroy', (player) => {
    // Clear auto-disconnect timer when player is manually destroyed
    clearAutoDisconnectTimer(player.guildId);
    console.log(`[${player.guildId}] Player destroyed - cleared auto-disconnect timer`);
});

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

console.log('🎵 Mufflins Music Bot is starting...');

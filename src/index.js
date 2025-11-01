const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
console.log(`[Config] Loading .env from: ${envPath}`);
const envFileExists = fs.existsSync(envPath);
console.log(`[Config] .env file exists: ${envFileExists}`);

// Only try to load .env if the file exists (local development)
// On Railway/cloud, environment variables are already set via process.env
let result = { error: null, parsed: {} };
if (envFileExists) {
  // CRITICAL: Only clear env vars if .env file exists (local dev only)
  // On Railway, process.env variables should NOT be deleted
  if (process.env.LAVALINK_URL && envFileExists) {
    console.log(`[Config] Local dev: LAVALINK_URL already set in environment: "${process.env.LAVALINK_URL}"`);
    console.log(`[Config] Local dev: Deleting it to force reload from .env file...`);
    delete process.env.LAVALINK_URL;
  }

  // Use override: true to ensure .env file values take precedence over existing env vars (local only)
  result = require('dotenv').config({ path: envPath, override: true });
} else {
  console.log(`[Config] No .env file found - using environment variables from platform (Railway/cloud)`);
}

if (result.error && envFileExists) {
  console.warn('Warning: Could not load .env file:', result.error.message);
} else if (envFileExists) {
  console.log(`[Config] .env loaded successfully (${Object.keys(result.parsed || {}).length} variables)`);
  console.log(`[Config] Dotenv parsed LAVALINK_URL: "${result.parsed?.LAVALINK_URL || 'NOT FOUND'}"`);
  console.log(`[Config] Process.env LAVALINK_URL after dotenv: "${process.env.LAVALINK_URL || 'NOT SET'}"`);
  
  // Force set it if dotenv parsed it but process.env doesn't have it (local dev only)
  if (result.parsed?.LAVALINK_URL && process.env.LAVALINK_URL !== result.parsed.LAVALINK_URL) {
    console.log(`[Config] WARNING: Mismatch! Forcing process.env.LAVALINK_URL to parsed value...`);
    process.env.LAVALINK_URL = result.parsed.LAVALINK_URL;
  }
} else {
  // Cloud deployment - log what we have from process.env
  console.log(`[Config] Using environment variables from platform:`);
  console.log(`[Config] LAVALINK_URL from process.env: "${process.env.LAVALINK_URL || 'NOT SET'}"`);
  console.log(`[Config] TOKEN from process.env: "${process.env.TOKEN ? 'SET' : 'NOT SET'}"`);
}

const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const { Rainlink, Library } = require('rainlink');

const PREFIX = process.env.PREFIX || 'mm!';
const TOKEN = process.env.TOKEN || '';

// Lavalink configuration (REQUIRED for Rainlink)
console.log(`[Config] Reading process.env.LAVALINK_URL: "${process.env.LAVALINK_URL || 'NOT SET'}"`);
const LAVALINK_URL = process.env.LAVALINK_URL || 'localhost:2333';
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || 'youshallnotpass';
const LAVALINK_SECURE = process.env.LAVALINK_SECURE === 'true';
const LAVALINK_NAME = process.env.LAVALINK_NAME || 'Mufflins-Lavalink';

// Debug: Log the loaded environment variables
console.log('[Config] Loaded Lavalink config:');
console.log(`[Config] LAVALINK_URL: ${LAVALINK_URL}`);
console.log(`[Config] LAVALINK_PASSWORD: ${LAVALINK_PASSWORD ? '***' + LAVALINK_PASSWORD.slice(-4) : 'NOT SET'}`);
console.log(`[Config] LAVALINK_SECURE: ${LAVALINK_SECURE}`);
console.log(`[Config] LAVALINK_NAME: ${LAVALINK_NAME}`);

if (!TOKEN) {
  console.error('Missing TOKEN in environment. Create a .env with TOKEN=your_bot_token');
  process.exit(1);
}

// Parse Lavalink URL (host:port)
const [lavalinkHost, lavalinkPort = LAVALINK_SECURE ? '443' : '2333'] = LAVALINK_URL.split(':');

// Debug: Log parsed connection details
console.log(`[Config] Parsed connection details:`);
console.log(`[Config] Host: ${lavalinkHost}`);
console.log(`[Config] Port: ${lavalinkPort}`);
console.log(`[Config] Secure: ${LAVALINK_SECURE}`);
console.log(`[Config] Password: ${LAVALINK_PASSWORD ? 'SET' : 'NOT SET'}`);
console.log(`[Config] Node Name: ${LAVALINK_NAME}`);

// Initialize bot client
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

// Initialize Rainlink Manager (Lavalink client)
// We'll initialize it after bot is ready since it needs the bot client
let rainlink;


// Search cache for faster repeated searches
const searchCache = new Map();
const CACHE_MAX_AGE = 300000; // 5 minutes
const CACHE_MAX_SIZE = 100; // Max 100 cached searches

// Track preloading map (guildId -> preloaded track)
const preloadedTracks = new Map();

// Auto-disconnect tracking (guildId -> timeout)
const autoDisconnectTimers = new Map();
const AUTO_DISCONNECT_DELAY = 300000; // 5 minutes (300000ms)

// Track guilds that are currently disconnecting to prevent duplicate disconnect commands
const disconnectingGuilds = new Set();

// Helper function to ensure node is ready (connected and session initialized)
async function ensureNodeReady(rainlink, nodeName, maxWaitTime = 10000) {
  const node = rainlink.nodes.get(nodeName) || rainlink.nodes.all()[0];
  if (!node) {
    throw new Error('No Lavalink node available');
  }
  
  // Check if node is connected (state 0 = Connected)
  if (node.state === 0 && node.online) {
    // Give it a brief moment for session to initialize (even if already connected)
    await new Promise(resolve => setTimeout(resolve, 300));
    return true;
  }
  
  // Wait for node to connect
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    let resolved = false;
    let nodeConnectHandler = null;
    
    const resolveOnce = () => {
      if (resolved) return;
      resolved = true;
      // Give it a moment for session to initialize after connection
      setTimeout(() => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        if (nodeConnectHandler) {
          rainlink.off('nodeConnect', nodeConnectHandler);
        }
        resolve(true);
      }, 500);
    };
    
    const checkInterval = setInterval(() => {
      if (node.state === 0 && node.online) {
        resolveOnce();
      }
      
      if (Date.now() - startTime > maxWaitTime) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        if (nodeConnectHandler) {
          rainlink.off('nodeConnect', nodeConnectHandler);
        }
        if (!resolved) {
          resolved = true;
          reject(new Error('Node connection timeout'));
        }
      }
    }, 100);
    
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      if (nodeConnectHandler) {
        rainlink.off('nodeConnect', nodeConnectHandler);
      }
      if (!resolved) {
        resolved = true;
        reject(new Error('Node ready check timeout'));
      }
    }, maxWaitTime);
    
    // Also listen for nodeConnect event
    nodeConnectHandler = (connectedNode) => {
      if (connectedNode === node || connectedNode.options?.name === nodeName) {
        resolveOnce();
      }
    };
    
    rainlink.on('nodeConnect', nodeConnectHandler);
    
    // If already connected, resolve immediately
    if (node.state === 0 && node.online) {
      resolveOnce();
    }
  });
}

// Icon path cache (commandName -> iconPath) - loaded once at startup
const iconCache = new Map();

// Helper function to setup auto-disconnect
function setupAutoDisconnect(guildId, voiceChannelId) {
  // Clear existing timer if any
  const existingTimer = autoDisconnectTimers.get(guildId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // Set new timer
  const timer = setTimeout(async () => {
    try {
      const player = rainlink?.players?.get(guildId);
      if (!player) {
        autoDisconnectTimers.delete(guildId);
        return;
      }
      
      // Check if bot is still in voice channel
      const guild = bot.guilds.cache.get(guildId);
      if (!guild) {
        autoDisconnectTimers.delete(guildId);
        return;
      }
      
      const botMember = guild.members.me;
      if (!botMember?.voice?.channelId) {
        autoDisconnectTimers.delete(guildId);
        return;
      }
      
      // Check if anyone else is in the voice channel (excluding bot)
      const voiceChannel = guild.channels.cache.get(botMember.voice.channelId);
      if (!voiceChannel) {
        autoDisconnectTimers.delete(guildId);
        return;
      }
      
      const members = voiceChannel.members.filter(m => !m.user.bot);
      const memberCount = members.size;
      
      if (memberCount === 0) {
        console.log(`[${guildId}] Auto-disconnecting: No users in voice channel`);
        const channel = bot.channels.cache.get(player.textId);
        if (channel) {
          channel.send(buildEmbed('Auto-Disconnected', 'Disconnected due to inactivity (no users in voice channel).', 'stop')).catch(() => {});
        }
        
        player.disconnect();
        await rainlink.destroy(guildId);
        autoDisconnectTimers.delete(guildId);
        preloadedTracks.delete(guildId);
      } else {
        // Someone is still there, reset timer
        autoDisconnectTimers.delete(guildId);
        setupAutoDisconnect(guildId, voiceChannelId);
      }
    } catch (error) {
      console.error(`[Auto-disconnect] Error for guild ${guildId}:`, error);
      autoDisconnectTimers.delete(guildId);
    }
  }, AUTO_DISCONNECT_DELAY);
  
  autoDisconnectTimers.set(guildId, timer);
  console.log(`[${guildId}] Auto-disconnect timer set (${AUTO_DISCONNECT_DELAY / 1000}s)`);
}

// Helper functions
// Load all icons into cache at startup (much faster than reading directory each time)
function loadIconCache() {
  try {
    const iconsDir = path.join(process.cwd(), 'mufflins icons');
    if (!fs.existsSync(iconsDir)) {
      console.log('[Icons] Icons directory not found, skipping icon cache');
      return;
    }
    const entries = fs.readdirSync(iconsDir);
    console.log(`[Icons] Loading ${entries.length} icon files into cache...`);
    
    // Build cache: map common command names to their icon files
    const commandAliases = {
      'play': ['play', 'p'],
      'queue': ['queue', 'q'],
      'skip': ['skip', 's'],
      'pause': ['pause'],
      'resume': ['resume'],
      'stop': ['stop'],
      'volume': ['volume', 'vol'],
      'nowplaying': ['np', 'nowplaying', 'now'],
      'join': ['join', 'j'],
      'help': ['help', 'h']
    };
    
    entries.forEach(file => {
      const fileName = file.toLowerCase().replace(/\.(png|jpg|jpeg|gif)$/i, '');
      // Check all command aliases
      for (const [command, aliases] of Object.entries(commandAliases)) {
        if (aliases.some(alias => fileName.includes(alias) || fileName.startsWith(alias))) {
          if (!iconCache.has(command)) {
            iconCache.set(command, path.join(iconsDir, file));
          }
        }
      }
      // Also store exact filename matches (without extension)
      const baseName = fileName.replace(/^mufflins?_/, '');
      if (baseName && !iconCache.has(baseName)) {
        iconCache.set(baseName, path.join(iconsDir, file));
      }
    });
    
    console.log(`[Icons] Cached ${iconCache.size} icon paths`);
  } catch (error) {
    console.error('[Icons] Error loading icon cache:', error.message);
  }
}

function getIconPathFor(commandName) {
  // First try exact match
  if (iconCache.has(commandName)) {
    return iconCache.get(commandName);
  }
  
  // Try lowercase match
  const lowerCommand = commandName.toLowerCase();
  if (iconCache.has(lowerCommand)) {
    return iconCache.get(lowerCommand);
  }
  
  // Try partial match (find first icon that contains command name)
  for (const [cachedName, iconPath] of iconCache.entries()) {
    if (cachedName.includes(lowerCommand) || lowerCommand.includes(cachedName)) {
      return iconPath;
    }
  }
  
  return null;
}

function formatDuration(ms) {
  if (!ms || isNaN(ms)) return 'Unknown';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function buildEmbed(title, description, commandForIcon, color = 0x8e7cc3) {
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
  const iconPath = getIconPathFor(commandForIcon);
  if (iconPath) {
    embed.setThumbnail('attachment://icon.png');
    return { embeds: [embed], files: [{ attachment: iconPath, name: 'icon.png' }] };
  }
  return { embeds: [embed] };
}

// Bot ready event
bot.once('ready', () => {
  console.log(`Logged in as ${bot.user.tag}`);
  bot.user.setActivity('music | mm!help');
  
  // Load icon cache at startup (one-time operation, much faster than per-command file reads)
  loadIconCache();
  
  // CRITICAL: Verify bot.user.id is definitely available before initializing Rainlink
  if (!bot.user || !bot.user.id) {
    console.error('[Rainlink] ERROR: bot.user.id is not available! Cannot initialize Rainlink.');
    return;
  }
  
  console.log(`[Rainlink] Bot ready, bot.user.id confirmed: ${bot.user.id}`);
  console.log('[Rainlink] Initializing Rainlink...');
  
  // Use setImmediate to ensure all ready event handlers have finished
  // This allows Rainlink's internal ready listener to set up properly
  setImmediate(() => {
    // Initialize Rainlink with Discord.js library connector
    console.log(`[Rainlink] Initializing with node: ${lavalinkHost}:${lavalinkPort}`);
    
    // Create library connector and verify it can get user ID immediately
    const libraryConnector = new Library.DiscordJS(bot);
    const testUserId = libraryConnector.getId();
    console.log(`[Rainlink] Library connector created, test getId(): ${testUserId}`);
    
    if (!testUserId || testUserId === 'undefined') {
      console.error('[Rainlink] ERROR: Library connector cannot get user ID! Delaying initialization...');
      setTimeout(() => {
        initializeRainlink();
      }, 3000);
      return;
    }
    
    initializeRainlink();
    
    function initializeRainlink() {
      // CRITICAL: Initialize Rainlink WITHOUT nodes first, then add nodes after ID is set
      // This prevents nodes from connecting before the user ID is properly configured
      rainlink = new Rainlink({
        library: libraryConnector,
        nodes: [], // Start with NO nodes - we'll add them after ID is confirmed
        options: {
          defaultSearchEngine: 'youtube',
          defaultVolume: 50
        }
      });

      console.log(`[Rainlink] Rainlink initialized. Bot user ID: ${bot.user?.id || 'NOT AVAILABLE'}`);
      
      // CRITICAL FIX: Set manager.id IMMEDIATELY after creation
      // This must happen before ANY node operations
      console.log(`[Rainlink] Setting manager ID BEFORE adding nodes...`);
      try {
        rainlink.id = bot.user.id;
        console.log(`[Rainlink] Manager ID set to: ${rainlink.id}`);
        
        // Verify the ID is actually set
        if (!rainlink.id || rainlink.id === 'undefined' || rainlink.id.toString() !== bot.user.id.toString()) {
          console.error(`[Rainlink] CRITICAL: Manager ID not properly set! Expected: ${bot.user.id}, Got: ${rainlink.id}`);
          // Force set it again
          rainlink.id = bot.user.id;
          console.log(`[Rainlink] Manager ID force-set to: ${rainlink.id}`);
        } else {
          console.log(`[Rainlink] Manager ID verified: ${rainlink.id}`);
        }
      } catch (err) {
        console.error(`[Rainlink] Failed to set manager ID:`, err);
        rainlink.id = bot.user.id; // Force set anyway
      }
  
      // NOW add the node AFTER ID is confirmed
      // Wait a brief moment to ensure ID is fully propagated
      setTimeout(() => {
        console.log(`[Rainlink] Manager ID before node addition: ${rainlink.id}`);
        console.log(`[Rainlink] Bot user ID: ${bot.user.id}`);
        console.log(`[Rainlink] IDs match: ${rainlink.id === bot.user.id}`);
        
        // Double-check ID one more time
        if (!rainlink.id || rainlink.id.toString() !== bot.user.id.toString()) {
          console.error(`[Rainlink] ERROR: Manager ID mismatch! Setting again...`);
          rainlink.id = bot.user.id;
        }
        
        try {
          console.log(`[Rainlink] Attempting to add node with config:`);
          console.log(`[Rainlink]   Name: ${LAVALINK_NAME}`);
          console.log(`[Rainlink]   Host: ${lavalinkHost}`);
          console.log(`[Rainlink]   Port: ${parseInt(lavalinkPort)}`);
          console.log(`[Rainlink]   Secure: ${LAVALINK_SECURE}`);
          console.log(`[Rainlink]   Auth: ${LAVALINK_PASSWORD ? 'SET' : 'NOT SET'}`);
          console.log(`[Rainlink]   Manager ID: ${rainlink.id}`);
          
          const addedNode = rainlink.nodes.add({
            name: LAVALINK_NAME,
            host: lavalinkHost,
            port: parseInt(lavalinkPort),
            auth: LAVALINK_PASSWORD,
            secure: LAVALINK_SECURE
          });
          console.log(`[Rainlink] Node added: ${addedNode.options.name}`);
          console.log(`[Rainlink] Manager ID after adding node: ${rainlink.id}`);
          console.log(`[Rainlink] Node should connect now with user ID: ${rainlink.id}`);
        } catch (err) {
          console.error(`[Rainlink] Failed to add node:`, err);
          console.error(`[Rainlink] Error details:`, err.message);
        }
      }, 500); // Brief delay to ensure ID is set

      // Rainlink event handlers


      // Track disconnection timestamps to prevent reconnect storms
      // This is especially important on Railway where restarts can trigger rate-limiting
      let lastDisconnectTime = 0;
      let disconnectCount = 0;
      let consecutiveDisconnects = 0;
      const RECONNECT_COOLDOWN = 10000; // 10 seconds cooldown after multiple disconnects
      const MAX_CONSECUTIVE_DISCONNECTS = 5; // After 5 consecutive disconnects, wait longer
      
      // Detect if running on Railway
      const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
      
      // Reset consecutive disconnect counter on successful connection
      rainlink.on('nodeConnect', (node) => {
        const nodeName = node?.name || node?.options?.name || 'Unknown';
        console.log(`[Rainlink] ✅ Connected to Lavalink node: ${nodeName}`);
        console.log(`[Rainlink] Manager ID at connection: ${rainlink.id}`);
        
        // Reset consecutive disconnect counter on successful connection
        if (consecutiveDisconnects > 0) {
          console.log(`[Rainlink] Connection successful - resetting disconnect counter`);
          consecutiveDisconnects = 0;
        }
        
        // Verify manager ID is still correct after connection
        if (!rainlink.id || rainlink.id === 'undefined') {
          console.error(`[Rainlink] CRITICAL: Manager ID is undefined after connection!`);
          console.error(`[Rainlink] This will cause immediate disconnection. Fixing...`);
          rainlink.id = bot.user.id;
        }
      });
      
      rainlink.on('nodeDisconnect', (node, reason) => {
        const nodeName = node?.name || node?.options?.name || 'Unknown';
        const now = Date.now();
        disconnectCount++;
        consecutiveDisconnects++;
        lastDisconnectTime = now;
        
        console.warn(`[Rainlink] ⚠️ Disconnected from Lavalink node: ${nodeName} - Reason: ${reason}`);
        console.warn(`[Rainlink] Manager ID at disconnect: ${rainlink.id}`);
        console.warn(`[Rainlink] Connection details: ${lavalinkHost}:${lavalinkPort} (secure: ${LAVALINK_SECURE})`);
        
        // Log connection details for debugging
        if (reason === 1000 || reason === '1000') {
          console.warn(`[Rainlink] Normal WebSocket close (1000) - may indicate:`);
          console.warn(`[Rainlink]   1. Lavalink service not running or crashed`);
          console.warn(`[Rainlink]   2. Network connectivity issue (if using internal networking, check service name)`);
          console.warn(`[Rainlink]   3. Wrong host/port configuration`);
          console.warn(`[Rainlink]   4. Authentication failure (check password)`);
        }
        
        // If running on Railway and getting rapid disconnects, likely rate-limiting from server
        if (isRailway && consecutiveDisconnects >= 3) {
          console.warn(`[Rainlink] Railway deployment detected - rapid disconnects may be due to:`);
          console.warn(`[Rainlink] 1. Railway restarts triggering reconnection attempts`);
          console.warn(`[Rainlink] 2. Public Lavalink server rate-limiting Railway's IP`);
          console.warn(`[Rainlink] 3. Network instability between Railway and Lavalink server`);
        }
        
        // Code 1000 is normal closure - but if it happens repeatedly, the server is rejecting connections
        if (reason === 1000) {
          console.log(`[Rainlink] Normal closure (1000) - checking if manager ID is valid...`);
          if (!rainlink.id || rainlink.id === 'undefined') {
            console.error(`[Rainlink] PROBLEM FOUND: Manager ID is undefined! This is why it disconnected.`);
            console.error(`[Rainlink] Setting manager ID to: ${bot.user.id}`);
            rainlink.id = bot.user.id;
            console.log(`[Rainlink] Manager ID fixed. Node should reconnect automatically now.`);
          } else {
            console.log(`[Rainlink] Manager ID is valid (${rainlink.id})`);
            
            // If we're getting rapid disconnects, the server is likely rejecting connections
            if (consecutiveDisconnects >= 3) {
              console.error(`[Rainlink] ERROR: ${consecutiveDisconnects} consecutive disconnects detected!`);
              console.error(`[Rainlink] The Lavalink server (${LAVALINK_NAME}) is actively rejecting connections.`);
              
              if (isRailway) {
                console.error(`[Rainlink] Railway deployment detected - this is likely due to:`);
                console.error(`[Rainlink] - Railway restarts causing reconnection attempts`);
                console.error(`[Rainlink] - Public server rate-limiting Railway's IP address`);
                console.error(`[Rainlink] - Network issues between Railway and the Lavalink server`);
              }
              
              console.error(`[Rainlink] This is a SERVER-SIDE issue, not a bot configuration problem.`);
              console.error(`[Rainlink] SOLUTIONS:`);
              console.error(`[Rainlink] 1. Switch to a different public Lavalink server`);
              console.error(`[Rainlink] 2. Self-host Lavalink on Railway (recommended for stability)`);
              console.error(`[Rainlink] 3. Use Railway's free tier limits - may need paid plan for 24/7 uptime`);
              console.error(`[Rainlink] 4. The bot will continue attempting to reconnect...`);
              
              // After 5 consecutive disconnects, log critical warning
              if (consecutiveDisconnects >= MAX_CONSECUTIVE_DISCONNECTS) {
                console.error(`[Rainlink] CRITICAL: ${consecutiveDisconnects} consecutive disconnects!`);
                console.error(`[Rainlink] The server is likely rate-limiting. Consider self-hosting Lavalink.`);
              }
            }
            
            // Reset disconnect count after 2 minutes of stability
            setTimeout(() => {
              if (Date.now() - lastDisconnectTime > 120000) {
                disconnectCount = 0;
                console.log(`[Rainlink] Disconnect counter reset - connection seems stable now`);
              }
            }, 120000);
          }
        }
        
        // Error 1011 usually means undefined user ID
        if (reason === 1011 || reason === '1011') {
          console.warn(`[Rainlink] Connection error 1011 (undefined user ID)`);
          if (!rainlink.id || rainlink.id === 'undefined') {
            console.error(`[Rainlink] Manager ID is undefined - fixing...`);
            rainlink.id = bot.user.id;
          }
        }
      });

      // Track last sent "Now playing" message to prevent duplicates
      const lastPlayingTrack = new Map();

      rainlink.on('trackStart', (player, track) => {
        console.log(`[${player.guildId}] Now playing: ${track.title}`);
        
        // Clear auto-disconnect timer since someone is playing music
        const existingTimer = autoDisconnectTimers.get(player.guildId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          autoDisconnectTimers.delete(player.guildId);
          console.log(`[${player.guildId}] Auto-disconnect timer cleared (music is playing)`);
        }
        
        // Only send "Now playing" message if it's a different track (prevent duplicates)
        const lastTrack = lastPlayingTrack.get(player.guildId);
        if (!lastTrack || lastTrack.identifier !== track.identifier) {
          lastPlayingTrack.set(player.guildId, track);
          const channel = bot.channels.cache.get(player.textId);
          if (channel) {
            channel.send(buildEmbed('Now Playing', `🎵 ${track.title}`, 'nowplaying')).catch(() => {});
          }
        }
        
        // Preload next track info for smoother transitions (mark as ready)
        if (player.queue.length > 0) {
          const nextTrack = player.queue[0];
          if (nextTrack) {
            preloadedTracks.set(player.guildId, nextTrack);
            console.log(`[${player.guildId}] Next track ready: ${nextTrack.title}`);
          }
        } else {
          preloadedTracks.delete(player.guildId);
        }
      });

      rainlink.on('trackEnd', (player, track, reason) => {
        console.log(`[${player.guildId}] Track ended: ${track.title} - Reason: ${reason}`);
        
        // Clear the last playing track when it ends
        lastPlayingTrack.delete(player.guildId);
        
        // Only auto-play next track if:
        // 1. Queue has tracks
        // 2. Not in song loop mode
        // 3. Reason is not 'REPLACED' (skip command handles it)
        if (player.queue.length > 0 && player.loop !== 'song' && reason !== 'REPLACED') {
          console.log(`[${player.guildId}] Auto-playing next track from queue...`);
          // Small delay to ensure track is fully ended
          setTimeout(() => {
            if (player.queue.length > 0 && !player.playing) {
              player.play().catch(err => {
                console.error(`[${player.guildId}] Error auto-playing next track:`, err.message);
              });
            }
          }, 500);
        }
      });

      rainlink.on('trackResolveError', (player, track, error) => {
        console.error(`[${player.guildId}] Track error: ${track?.title || 'Unknown'} - ${error.message}`);
        const channel = bot.channels.cache.get(player.textId);
        if (channel) {
          channel.send(`❌ Playback error: ${error.message || 'Unknown error'}`).catch(() => {});
        }
      });

      rainlink.on('queueEmpty', (player) => {
        console.log(`[${player.guildId}] Queue ended`);
        const channel = bot.channels.cache.get(player.textId);
        if (channel) {
          channel.send(buildEmbed('Queue Empty', 'The queue has finished. Add more songs with `mm!play`!', 'queue')).catch(() => {});
        }
        // Clear preloaded track
        preloadedTracks.delete(player.guildId);
        // Start auto-disconnect timer (no one is actively queuing)
        if (player.voiceId) {
          setupAutoDisconnect(player.guildId, player.voiceId);
        }
      });

      rainlink.on('playerDestroy', (player) => {
        console.log(`[${player.guildId}] Player destroyed`);
      });

      rainlink.on('playerConnect', (player) => {
        console.log(`[Rainlink] Player connected to voice channel in guild ${player.guildId}`);
      });

      rainlink.on('playerDisconnect', (player, reason) => {
        console.log(`[Rainlink] Player disconnected from guild ${player.guildId}, reason: ${reason}`);
        // Clear auto-disconnect timer if player disconnects
        const existingTimer = autoDisconnectTimers.get(player.guildId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          autoDisconnectTimers.delete(player.guildId);
        }
        // Clear preloaded track
        preloadedTracks.delete(player.guildId);
      });

      rainlink.on('playerUpdate', (player) => {
        if (player.state !== undefined) {
          console.log(`[Rainlink] Player ${player.guildId} state: ${player.state}`);
        }
      });
    }
  });
});

// Handle voice state updates for Rainlink
// Rainlink handles this automatically through the library connector, but we can add manual handling if needed

// Command handler
bot.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.toLowerCase().startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = (args.shift() || '').toLowerCase();

  // Debug: log all commands
  console.log(`[Command] Received: ${PREFIX}${command} from ${message.author.tag}`);

  if (command === 'help') {
    const helpText = [
      '**mm!play** or **mm!p <url|search>** — Play song or add to queue',
      '**mm!join** — Join your voice channel',
      '**mm!skip** — Skip current song',
      '**mm!clear** — Clear the queue and stop current track',
      '**mm!stop** — Stop and clear queue',
      '**mm!pause** — Pause playback',
      '**mm!resume** — Resume playback',
      '**mm!queue** — Show queue',
      '**mm!np** — Show now playing',
      '**mm!volume <0-100>** — Set volume',
      '**mm!shuffle** — Shuffle the queue',
      '**mm!loop <off|track|queue>** — Set loop mode',
      '**mm!remove <number>** — Remove track from queue',
      '**mm!seek <time>** — Jump to timestamp (e.g., 1:30 or 90)',
      '**mm!dc** — Disconnect bot from voice channel',
      '**mm!status** — Check Lavalink connection status'
    ].join('\n');
    return void message.channel.send(buildEmbed('Mufflins Music — Help', helpText, 'help'));
  }

  if (command === 'status') {
    try {
      console.log('[Status] Command received');
      
      if (!rainlink) {
        console.log('[Status] Rainlink not initialized');
        return void message.channel.send(buildEmbed('Connection Status', '❌ Rainlink is not initialized', 'help'));
      }
      
      console.log('[Status] Getting nodes...');
      const nodes = rainlink.nodes.all();
      console.log(`[Status] Found ${nodes.length} node(s)`);
      
      if (nodes.length === 0) {
        return void message.channel.send(buildEmbed('Connection Status', '❌ No Lavalink nodes configured', 'help'));
      }
      
      const node = nodes[0];
      console.log('[Status] Node found:', node.options?.name || 'Unknown');
      
      const stateNames = {
        0: '✅ Connected',
        1: '❌ Disconnected',
        2: '⚠️ Closed'
      };
      
      const nodeName = node.options?.name || 'Unknown';
      const nodeHost = node.options?.host || 'Unknown';
      const nodePort = node.options?.port || 'Unknown';
      const nodeState = node.state !== undefined ? node.state : 'Unknown';
      const nodeOnline = node.online !== undefined ? node.online : false;
      const playerCount = rainlink.players?.size || 0;
      
      const statusText = [
        `**Node:** ${nodeName}`,
        `**Host:** ${nodeHost}:${nodePort}`,
        `**Status:** ${stateNames[nodeState] || `Unknown (${nodeState})`}`,
        `**Online:** ${nodeOnline ? '✅ Yes' : '❌ No'}`,
        `**Players:** ${playerCount} active`
      ].join('\n');
      
      console.log('[Status] Sending status embed');
      return void message.channel.send(buildEmbed('Lavalink Connection Status', statusText, 'help'));
    } catch (error) {
      console.error('[Status] Error:', error);
      return void message.channel.send(buildEmbed('Connection Status', `❌ Error: ${error.message}`, 'help'));
    }
  }

  if (command === 'play' || command === 'p') {
    const query = args.join(' ');
    if (!query) return void message.reply('Provide a YouTube/Spotify link or search text.');
    
    console.log(`[Rainlink] Play command - query: "${query}"`);
    
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return void message.reply('Join a voice channel first.');
    
    // Check permissions
    const permissions = voiceChannel.permissionsFor(message.guild.members.me);
    if (!permissions?.has(['Connect', 'Speak'])) {
      return void message.reply('I need **Connect** and **Speak** permissions in that voice channel.');
    }

    try {
      await message.react('⏳').catch(() => {});
      
      // Get or create player
      if (!rainlink) {
        return void message.reply('❌ Rainlink is not initialized yet. Please wait a moment.');
      }
      
      // CRITICAL: Ensure Lavalink node is connected and session is ready
      try {
        await ensureNodeReady(rainlink, LAVALINK_NAME, 10000);
        console.log('[Rainlink] Node is ready. Creating/getting player first, then searching...');
      } catch (error) {
        console.error('[Rainlink] Node not ready for play:', error.message);
        return void message.reply('❌ Lavalink node is not ready. Please wait a moment and try again.');
      }
      
      // Format query for search: handle plain text queries intelligently
      let searchQuery = query;
      let isUrl = query.startsWith('http://') || query.startsWith('https://');
      let hasSearchPrefix = query.startsWith('ytsearch:') || query.startsWith('scsearch:') || query.startsWith('spsearch:');
      
      // If it's a plain text query (not URL, not prefixed), we'll try multiple sources
      if (!isUrl && !hasSearchPrefix) {
        // Try plain query first (Lavalink might auto-detect), then fallback to ytsearch:
        // For now, use ytsearch: as primary (most reliable)
        searchQuery = `ytsearch:${query}`;
        console.log(`[Rainlink] Formatted search query as: "${searchQuery}"`);
      }
      
      // Create/get player first (required for player.search() which returns proper RainlinkTrack objects)
      let player = rainlink.players.get(message.guild.id);
      
      // Fast path: If player exists and is ready, we can search immediately
      if (player && player.state === 0 && player.voiceId === voiceChannel.id) {
        console.log('[Rainlink] Player already ready, searching immediately...');
        // Skip to search - player is ready
      } else if (!player) {
        console.log('[Rainlink] Creating new player (optimized for speed)...');
        
        // Create the player immediately (no pre-waiting)
        player = await rainlink.create({
          guildId: message.guild.id,
          shardId: message.guild.shardId || 0,
          voiceId: voiceChannel.id,
          textId: message.channel.id,
          volume: 50,
          deaf: true
        });
        console.log('[Rainlink] Player created, checking connection...');
        
        // Setup auto-disconnect check for this player
        setupAutoDisconnect(message.guild.id, voiceChannel.id);
        
        // Optimized connection wait - try to proceed quickly
        let connectionReady = false;
        let waitAttempts = 0;
        const maxWaitAttempts = 15; // Reduced total wait time
        
        // Quick check if already connected
        if (player.state === 0) {
          console.log('[Rainlink] Player connected immediately!');
          connectionReady = true;
        } else {
          // Wait for connection with faster polling
          while (!connectionReady && waitAttempts < maxWaitAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Very fast polling (was 200ms)
            waitAttempts++;
            
            if (player.state === 0) {
              connectionReady = true;
              console.log(`[Rainlink] Player connected after ${waitAttempts * 100}ms`);
              break;
            }
            
            // Check via event too (non-blocking)
            const onceHandler = (connectedPlayer) => {
              if (connectedPlayer.guildId === message.guild.id && connectedPlayer.state === 0) {
                connectionReady = true;
              }
            };
            rainlink.once('playerConnect', onceHandler);
            
            // Clean up after short time
            setTimeout(() => rainlink.off('playerConnect', onceHandler), 150);
          }
        }
        
        if (!connectionReady) {
          console.log('[Rainlink] Connection not fully ready, proceeding anyway (may retry if search fails)...');
          // Small delay to let connection start
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } else if (player.voiceId !== voiceChannel.id) {
        // Move to new voice channel if needed
        player.setVoiceChannel(voiceChannel.id);
        
        // Reset auto-disconnect timer for new channel
        setupAutoDisconnect(message.guild.id, voiceChannel.id);
        
        // Wait for connection after moving using event
        await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(), 5000);
          
          const connectHandler = (connectedPlayer) => {
            if (connectedPlayer.guildId === message.guild.id) {
              clearTimeout(timeout);
              rainlink.off('playerConnect', connectHandler);
              // Reduced wait (was 500ms)
              setTimeout(() => resolve(), 200);
            }
          };
          
          rainlink.on('playerConnect', connectHandler);
          
          // Fallback: check state periodically (faster)
          let attempts = 0;
          const checkInterval = setInterval(() => {
            attempts++;
            if (player.state === 0 && attempts > 2) { // Reduced from 3
              clearTimeout(timeout);
              rainlink.off('playerConnect', connectHandler);
              clearInterval(checkInterval);
              setTimeout(() => resolve(), 200); // Reduced from 500ms
            } else if (attempts >= 15) { // Reduced from 25
              clearTimeout(timeout);
              rainlink.off('playerConnect', connectHandler);
              clearInterval(checkInterval);
              resolve();
            }
          }, 150); // Reduced from 200ms
        });
      }
      
      // CRITICAL: Use player.search() - it returns proper RainlinkTrack objects that work with queue
      console.log('[Rainlink] Using player.search() to get proper RainlinkTrack objects...');
      
      // Minimal final check - try to search immediately if player exists
      // If search fails, we'll retry with waits
      const botVoiceState = message.guild.members.me?.voice;
      const alreadyConnected = botVoiceState?.channelId === voiceChannel.id && player.state === 0;
      
      if (!alreadyConnected && player.state !== 0) {
        // Only do a very quick check - don't wait long
        console.log('[Rainlink] Quick connection check...');
        let quickCheck = 0;
        const maxQuickChecks = 3; // Very short wait
        while (player.state !== 0 && quickCheck < maxQuickChecks) {
          await new Promise(resolve => setTimeout(resolve, 100));
          quickCheck++;
        }
        if (player.state === 0) {
          console.log('[Rainlink] Connection ready!');
        } else {
          console.log('[Rainlink] Trying search anyway (will retry if needed)...');
        }
      } else {
        console.log('[Rainlink] Already connected or ready, proceeding immediately...');
      }

      // Check search cache first (only for non-URL searches)
      let searchResult = null;
      const originalQuery = query.toLowerCase(); // Use original query for cache key
      const cacheKey = isUrl ? null : originalQuery;
      
      if (cacheKey && searchCache.has(cacheKey)) {
        const cached = searchCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_MAX_AGE) {
          console.log(`[Rainlink] Using cached search result for: "${query}"`);
          searchResult = cached.result;
        } else {
          // Cache expired, remove it
          searchCache.delete(cacheKey);
        }
      }
      
      // Search using player.search() - try multiple sources for plain text queries
      let searchAttempts = 0;
      const maxSearchAttempts = 5;
      const searchSources = !isUrl && !hasSearchPrefix ? 
        [`ytsearch:${query}`, `scsearch:${query}`, query] : // Try YouTube, then SoundCloud, then plain
        [searchQuery]; // Use the query as-is (URL or prefixed)
      
      while (searchAttempts < maxSearchAttempts && (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0)) {
        try {
          // Before each search attempt, ensure node is still ready (might have disconnected)
          try {
            await ensureNodeReady(rainlink, LAVALINK_NAME, 5000);
          } catch (nodeError) {
            console.warn(`[Rainlink] Node not ready before search attempt ${searchAttempts + 1}, waiting...`);
            // Wait a bit longer and try to reconnect
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              await ensureNodeReady(rainlink, LAVALINK_NAME, 5000);
            } catch (retryError) {
              console.error(`[Rainlink] Node still not ready after retry: ${retryError.message}`);
              throw new Error('Lavalink node is not available. Please try again in a moment.');
            }
          }
          
          if (!searchResult) {
            // Try different search sources if previous one failed
            const currentSourceIndex = Math.min(searchAttempts, searchSources.length - 1);
            const currentSearchQuery = searchSources[currentSourceIndex];
            const sourceName = currentSourceIndex === 0 && searchSources.length > 1 ? 'YouTube' : 
                              currentSourceIndex === 1 ? 'SoundCloud' : 'Auto-detect';
            
            console.log(`[Rainlink] Attempting player.search() (attempt ${searchAttempts + 1}/${maxSearchAttempts})...`);
            console.log(`[Rainlink] Current player state: ${player.state}`);
            console.log(`[Rainlink] Search query: "${currentSearchQuery}"`);
            console.log(`[Rainlink] Source: ${sourceName}`);
            
            // Use player.search() - returns proper RainlinkTrack objects
            searchResult = await player.search(currentSearchQuery, {
              requester: message.author
            });
            
            // Cache the result if it's not a URL and cache isn't full
            if (cacheKey && searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
              // Remove oldest entries if cache is full
              if (searchCache.size >= CACHE_MAX_SIZE) {
                const firstKey = searchCache.keys().next().value;
                searchCache.delete(firstKey);
              }
              // Cache using original query (without prefix) for better matching
              searchCache.set(cacheKey, { result: searchResult, timestamp: Date.now() });
              console.log(`[Rainlink] Cached search result for: "${query}"`);
            }
          }
          
          // If we got results, break out
          if (searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
            console.log('[Rainlink] Player search successful!');
            console.log(`[Rainlink] Search result type: ${searchResult?.type || 'unknown'}`);
            console.log(`[Rainlink] Search result has tracks: ${searchResult?.tracks ? 'yes' : 'no'}`);
            console.log(`[Rainlink] Number of tracks: ${searchResult?.tracks?.length || 0}`);
            if (searchResult?.tracks && searchResult.tracks.length > 0) {
              console.log(`[Rainlink] First track title: ${searchResult.tracks[0]?.title || 'no title'}`);
              console.log(`[Rainlink] First track type: ${searchResult.tracks[0]?.constructor?.name || typeof searchResult.tracks[0]}`);
            }
            break; // Success, exit retry loop
          } else if (searchAttempts < searchSources.length - 1) {
            // No results but we have more sources to try
            const currentSourceName = searchSources[searchAttempts] === `ytsearch:${query}` ? 'YouTube' : 
                                     searchSources[searchAttempts] === `scsearch:${query}` ? 'SoundCloud' : 'Auto-detect';
            console.log(`[Rainlink] No results from ${currentSourceName}, trying next source...`);
            searchResult = null; // Reset to try next source
            searchAttempts++;
            continue;
          }
        } catch (searchError) {
          searchAttempts++;
          const errorMsg = searchError.message || '';
          console.error(`[Rainlink] Player search error (attempt ${searchAttempts}):`, errorMsg);
          
          // Check if node disconnected during search (common with Spotify URLs that take time to resolve)
          const node = rainlink.nodes.get(LAVALINK_NAME) || rainlink.nodes.all()[0];
          const nodeDisconnected = !node || node.state !== 0 || !node.online;
          
          if (errorMsg.includes('session id') || errorMsg.includes('session') || errorMsg.includes('not established') || nodeDisconnected) {
            if (searchAttempts < maxSearchAttempts) {
              // Wait longer for node to reconnect if it disconnected (especially for Spotify URLs)
              const waitTime = nodeDisconnected ? 2000 : (searchAttempts === 0 ? 300 : 500 * searchAttempts);
              console.log(`[Rainlink] ${nodeDisconnected ? 'Node disconnected' : 'Session issue'} detected, waiting ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              
              // Ensure node is ready again before retrying
              try {
                await ensureNodeReady(rainlink, LAVALINK_NAME, 8000);
                console.log(`[Rainlink] Node ready for retry attempt ${searchAttempts + 1}`);
              } catch (nodeReadyError) {
                console.error(`[Rainlink] Node not ready after wait: ${nodeReadyError.message}`);
                if (searchAttempts >= maxSearchAttempts - 1) {
                  throw new Error('Lavalink node disconnected during search. Please try again in a moment.');
                }
                // Continue to next attempt
                continue;
              }
              
              // Quick player connection check
              if (player.state !== 0) {
                console.log('[Rainlink] Player connection still not ready, quick wait...');
                let stateCheck = 0;
                while (player.state !== 0 && stateCheck < 5) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                  stateCheck++;
                }
              }
              
              // Reset searchResult to force a new search attempt
              searchResult = null;
              continue;
            }
          }
          throw searchError; // Re-throw if it's a different error or max attempts reached
        }
      }

      await message.reactions.removeAll().catch(() => {});
      
      // Assign searchResult to result for the rest of the code
      const result = searchResult;
      
      // Debug: Log the result structure
      console.log('[Rainlink] Final result check:');
      console.log(`[Rainlink] Result exists: ${!!result}`);
      if (result) {
        console.log(`[Rainlink] Result keys: ${Object.keys(result).join(', ')}`);
        console.log(`[Rainlink] Result type: ${result?.type || 'N/A'}`);
        console.log(`[Rainlink] Result.tracks exists: ${!!result?.tracks}`);
        console.log(`[Rainlink] Result.tracks is array: ${Array.isArray(result?.tracks)}`);
        console.log(`[Rainlink] Result.tracks length: ${result?.tracks?.length || 0}`);
        if (result?.tracks && result.tracks.length > 0) {
          console.log(`[Rainlink] First track title: ${result.tracks[0]?.title || 'N/A'}`);
        }
      }
      
      if (!result || !result.tracks || result.tracks.length === 0) {
        console.error('[Rainlink] No results found - full result:', JSON.stringify(result, null, 2));
        return void message.reply('No results found.');
      }

      // No delay needed - proceed immediately

      // Handle playlists vs single tracks
      if (result.type === 'PLAYLIST' && result.playlistName) {
        console.log(`[Rainlink] Handling playlist: ${result.playlistName} with ${result.tracks.length} tracks`);
        console.log(`[Rainlink] Player state before adding playlist: playing=${player.playing}, paused=${player.paused}, queue.length=${player.queue.length}`);
        
        // Add all tracks from playlist to queue
        // IMPORTANT: Don't add the first track to queue - it should be played directly
        // The rest go to the queue
        console.log(`[Rainlink] Adding ${result.tracks.length} tracks to queue...`);
        console.log(`[Rainlink] First track: ${result.tracks[0]?.title || 'Unknown'} (will be played directly, not queued)`);
        
        let addedCount = 0;
        // Start from index 1 - skip the first track as it will be played directly
        for (let i = 1; i < result.tracks.length; i++) {
          const track = result.tracks[i];
          try {
            player.queue.add(track);
            addedCount++;
          } catch (addError) {
            console.error(`[Rainlink] Error adding track ${i + 1} (${track.title || 'Unknown'}) to playlist queue:`, addError.message);
          }
          // Yield control periodically to prevent blocking (every 20 tracks for better performance)
          if ((i + 1) % 20 === 0 || i === result.tracks.length - 1) {
            await new Promise(resolve => setImmediate(resolve));
            if ((i + 1) % 50 === 0 || i === result.tracks.length - 1) {
              console.log(`[Rainlink] Progress: Added ${addedCount}/${result.tracks.length - 1} tracks to queue...`);
            }
          }
        }
        console.log(`[Rainlink] Successfully added ${addedCount}/${result.tracks.length - 1} tracks to queue (first track excluded)`);
        
        const queueLengthAfter = player.queue.length;
        console.log(`[Rainlink] Playlist tracks added. Queue length now: ${queueLengthAfter}`);
        
        const addedText = `Queued playlist: ${result.playlistName} (${result.tracks.length} tracks)`;
        
        // If player is not playing (regardless of paused state), start playback
        if (!player.playing) {
          console.log(`[Rainlink] Player not playing, starting playback from playlist...`);
          console.log(`[Rainlink] Current state: playing=${player.playing}, paused=${player.paused}, queue.length=${queueLengthAfter}`);
          console.log(`[Rainlink] Current track: ${player.queue.current ? player.queue.current.title : 'none'}`);
          
          try {
            // Always call player.play() to start from queue - it handles paused state internally
            if (queueLengthAfter > 0) {
              console.log(`[Rainlink] Starting playback from queue (${queueLengthAfter} tracks)...`);
              console.log(`[Rainlink] First track in queue: ${player.queue[0]?.title || 'N/A'}`);
              
              // If paused, resume first
              if (player.paused) {
                console.log(`[Rainlink] Player is paused, unpausing first...`);
                await player.setPause(false);
                // No delay needed - pause/unpause is instant
              }
              
              // Play the first track from the playlist result (not from queue)
              // The first track should be played directly, rest are in queue
              const firstTrack = result.tracks[0];
              if (firstTrack) {
                console.log(`[Rainlink] Playing first track from playlist: ${firstTrack.title}`);
                console.log(`[Rainlink] Remaining tracks in queue: ${queueLengthAfter}`);
                await player.play(firstTrack);
              } else {
                console.error(`[Rainlink] No first track in playlist result!`);
              }
              
              console.log(`[Rainlink] player.play() called. State after: playing=${player.playing}, paused=${player.paused}`);
              
              // Minimal verification wait (reduced from 300ms)
              await new Promise(resolve => setTimeout(resolve, 150));
              
              // Verify playback actually started
              if (!player.playing) {
                console.log(`[Rainlink] Playback didn't start, retrying...`);
                await player.play(firstTrack);
                // Minimal wait
                await new Promise(resolve => setTimeout(resolve, 150));
              }
            } else {
              console.error(`[Rainlink] Queue is empty after adding playlist!`);
            }
          } catch (playError) {
            console.error(`[Rainlink] Play error when starting playlist: ${playError.message}`);
            console.error(`[Rainlink] Error stack:`, playError.stack);
            if (playError.message && (playError.message.includes('session id') || playError.message.includes('not established'))) {
              console.log(`[Rainlink] Session issue, retrying after delay...`);
              await new Promise(resolve => setTimeout(resolve, 500)); // Reduced from 2000ms
              try {
                if (player.queue.length > 0) {
                  if (player.paused) {
                    await player.setPause(false);
                    // No delay needed
                  }
                  await player.play();
                }
              } catch (retryError) {
                console.error('[Rainlink] Play retry failed:', retryError.message);
              }
            }
          }
        } else {
          console.log(`[Rainlink] Player already playing, playlist tracks queued`);
        }
        
        // Reset auto-disconnect timer (user is actively using the bot)
        if (player.voiceId) {
          setupAutoDisconnect(message.guild.id, player.voiceId);
        }
        
        return void message.channel.send(buildEmbed('Added to Queue', addedText, 'queue'));
      } else {
        // Add single track
        const track = result.tracks[0];
        console.log(`[Rainlink] Adding track to queue: ${track.title || track.identifier}`);
        console.log(`[Rainlink] Track structure keys: ${Object.keys(track).join(', ')}`);
        console.log(`[Rainlink] Player state before adding: playing=${player.playing}, paused=${player.paused}, queue.length=${player.queue.length}`);
        
        // Prevent duplicate track additions
        // Strategy: Only use ONE method to add tracks to avoid duplicates
        const queueLengthBefore = player.queue.length;
        const wasAlreadyPlaying = player.playing; // Track if something was already playing
        console.log(`[Rainlink] Queue length before: ${queueLengthBefore}, already playing: ${wasAlreadyPlaying}`);
        
        if (player.playing) {
          // Player is already playing - just add to queue (don't call play)
          console.log(`[Rainlink] Player is playing, adding track to queue only...`);
          try {
            player.queue.add(track);
            console.log(`[Rainlink] Track added to queue. Queue length now: ${player.queue.length}`);
          } catch (queueError) {
            console.error(`[Rainlink] Error adding to queue:`, queueError.message);
          }
        } else {
          // Player not playing - ONLY use player.play(track) which handles both adding and playing
          // DO NOT call queue.add() first to avoid duplicates
          console.log(`[Rainlink] Player not playing, starting playback with track...`);
          try {
            // player.play(track) will automatically add the track to queue AND start playing
            await player.play(track);
            console.log(`[Rainlink] Playback started. State: playing=${player.playing}, paused=${player.paused}, queue.length=${player.queue.length}`);
            
            // Reduced verification wait (from 500ms to 200ms)
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Verify playback started
            if (!player.playing) {
              console.log(`[Rainlink] Playback didn't start, retrying...`);
              await player.play(track);
            }
          } catch (playError) {
            console.error(`[Rainlink] Play error: ${playError.message}`);
            if (playError.message && (playError.message.includes('session id') || playError.message.includes('not established'))) {
              console.log(`[Rainlink] Session issue, retrying after delay...`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced from 2000ms
              try {
                await player.play(track);
              } catch (retryError) {
                console.error('[Rainlink] Play retry failed:', retryError.message);
              }
            }
          }
        }
        
        console.log(`[Rainlink] Final state: playing=${player.playing}, paused=${player.paused}, queue.length=${player.queue.length}`);
        
        // Reset auto-disconnect timer (user is actively using the bot)
        if (player.voiceId) {
          setupAutoDisconnect(message.guild.id, player.voiceId);
        }
        
        // Only show "Added to Queue" if something was already playing (or it's added to queue while playing)
        // Don't show it for the first track that starts playing
        if (wasAlreadyPlaying) {
          return void message.channel.send(buildEmbed('Added to Queue', `Queued: ${track.title || 'Unknown'}`, 'queue'));
        }
        // Otherwise, just return without message (track is now playing, "Now Playing" event will handle notification)
      }
      
    } catch (error) {
      await message.reactions.removeAll().catch(() => {});
      console.error('Play error:', error);
      const errorMsg = error.message || 'Failed to play track';
      const shortMsg = errorMsg.length > 500 ? errorMsg.substring(0, 497) + '...' : errorMsg;
      return void message.reply(`Error: ${shortMsg}`);
    }
  }

  if (!rainlink) {
    return void message.reply('❌ Rainlink is not initialized yet. Please wait a moment.');
  }
  
  const player = rainlink.players.get(message.guild.id);
  
  // Commands that need an active player
  // Note: 'resume' doesn't need player.playing to be true (it might be paused)
  if (['skip', 'stop', 'volume', 'seek'].includes(command)) {
    if (!player || !player.playing) {
      return void message.reply('Nothing is currently playing.');
    }
  }
  
  // Commands that need a player but might be paused
  if (['pause', 'resume'].includes(command)) {
    if (!player) {
      return void message.reply('No player exists. Use mm!play to start playing music.');
    }
    if (!player.queue.current && !player.playing && !player.paused) {
      return void message.reply('Nothing is currently playing.');
    }
  }
  
  // Commands that just need a player (might be empty)
  if (['queue', 'np', 'shuffle', 'loop', 'remove', 'dc'].includes(command)) {
    if (!player) {
      return void message.reply('No player exists. Use mm!play to start playing music.');
    }
  }
  
  // Join command - doesn't need an existing player
  if (command === 'join') {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return void message.reply('Join a voice channel first.');
    
    // Check permissions
    const permissions = voiceChannel.permissionsFor(message.guild.members.me);
    if (!permissions?.has(['Connect', 'Speak'])) {
      return void message.reply('I need **Connect** and **Speak** permissions in that voice channel.');
    }
    
    try {
      if (!rainlink) {
        return void message.reply('❌ Rainlink is not initialized yet. Please wait a moment.');
      }
      
      // Check if already in this channel (fast check without cache lookup)
      const existingPlayer = rainlink.players.get(message.guild.id);
      if (existingPlayer && existingPlayer.voiceId === voiceChannel.id && existingPlayer.state === 0) {
        return void message.channel.send(buildEmbed('Join', `Already connected to <#${voiceChannel.id}>`, 'join'));
      }
      
      // CRITICAL: Ensure Lavalink node is connected and session is ready
      try {
        await ensureNodeReady(rainlink, LAVALINK_NAME, 10000);
      } catch (error) {
        console.error('[Rainlink] Node not ready for join:', error.message);
        return void message.reply('❌ Lavalink node is not ready. Please wait a moment and try again.');
      }
      
      // Create or get player
      let player = rainlink.players.get(message.guild.id);
      
      if (!player) {
        console.log('[Rainlink] Creating new player for join command...');
        player = await rainlink.create({
          guildId: message.guild.id,
          shardId: message.guild.shardId || 0,
          voiceId: voiceChannel.id,
          textId: message.channel.id,
          volume: 100,
          deaf: true
        });
        console.log(`[Rainlink] Player created for guild ${message.guild.id}, checking connection...`);
        
        // Setup auto-disconnect check for this player
        setupAutoDisconnect(message.guild.id, voiceChannel.id);
        
        // Wait for connection with optimized polling (similar to play command)
        let connectionReady = false;
        let waitAttempts = 0;
        const maxWaitAttempts = 30; // 3 seconds max (30 * 100ms)
        
        // Quick check if already connected
        if (player.state === 0) {
          console.log('[Rainlink] Player connected immediately!');
          connectionReady = true;
        } else {
          // Wait for connection with faster polling
          while (!connectionReady && waitAttempts < maxWaitAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            waitAttempts++;
            
            if (player.state === 0) {
              connectionReady = true;
              console.log(`[Rainlink] Player connected after ${waitAttempts * 100}ms`);
              break;
            }
            
            // Check via event too (non-blocking)
            const onceHandler = (connectedPlayer) => {
              if (connectedPlayer.guildId === message.guild.id && connectedPlayer.state === 0) {
                connectionReady = true;
              }
            };
            rainlink.once('playerConnect', onceHandler);
            
            // Clean up after short time
            setTimeout(() => rainlink.off('playerConnect', onceHandler), 150);
          }
        }
        
        if (connectionReady) {
          return void message.channel.send(buildEmbed('Joined', `Connected to <#${voiceChannel.id}>`, 'join'));
        } else {
          console.log('[Rainlink] Connection timeout, but player may still be connecting...');
          // Still send success message if player exists (connection might complete soon)
          return void message.channel.send(buildEmbed('Joined', `Connecting to <#${voiceChannel.id}>...`, 'join'));
        }
      } else {
        // Player exists - move to new channel if needed
        if (player.voiceId !== voiceChannel.id) {
          player.setVoiceChannel(voiceChannel.id);
          
          // Reset auto-disconnect timer for new channel
          setupAutoDisconnect(message.guild.id, voiceChannel.id);
          
          // Wait for connection after moving
          await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(), 5000);
            
            const connectHandler = (connectedPlayer) => {
              if (connectedPlayer.guildId === message.guild.id) {
                clearTimeout(timeout);
                rainlink.off('playerConnect', connectHandler);
                setTimeout(() => resolve(), 200);
              }
            };
            
            rainlink.on('playerConnect', connectHandler);
            
            // Fallback: check state periodically
            let attempts = 0;
            const checkInterval = setInterval(() => {
              attempts++;
              if (player.state === 0 && attempts > 2) {
                clearTimeout(timeout);
                rainlink.off('playerConnect', connectHandler);
                clearInterval(checkInterval);
                setTimeout(() => resolve(), 200);
              } else if (attempts >= 15) {
                clearTimeout(timeout);
                rainlink.off('playerConnect', connectHandler);
                clearInterval(checkInterval);
                resolve();
              }
            }, 150);
          });
        } else if (player.state === 0) {
          // Already connected to this channel
          setupAutoDisconnect(message.guild.id, voiceChannel.id);
          return void message.channel.send(buildEmbed('Join', `Already connected to <#${voiceChannel.id}>`, 'join'));
        }
        
        // Reset auto-disconnect timer
        setupAutoDisconnect(message.guild.id, voiceChannel.id);
        return void message.channel.send(buildEmbed('Joined', `Connected to <#${voiceChannel.id}>`, 'join'));
      }
    } catch (error) {
      console.error('[Rainlink] Join error:', error);
      return void message.reply(`❌ Error joining voice channel: ${error.message || 'Unknown error'}`);
    }
  }

  if (command === 'skip') {
    // Fast voice channel check (no cache lookup needed)
    const voiceChannel = message.member?.voice?.channel;
    if (voiceChannel && player.voiceId && voiceChannel.id !== player.voiceId) {
      return void message.reply('You need to be in the same voice channel as the bot.');
    }
    
    const queueLength = player.queue.length;
    const currentTrack = player.queue.current?.title || 'Unknown';
    console.log(`[Rainlink] Skip command - queue length: ${queueLength}, loop mode: ${player.loop}, current: ${currentTrack}`);
    
    // Reset auto-disconnect timer (user is actively using the bot)
    if (player.voiceId) {
      setupAutoDisconnect(message.guild.id, player.voiceId);
    }
    
    // Skip to next track - this should remove current and advance to next
    await player.skip();
    
    // Get next track info immediately (no delay needed)
    const newQueueLength = player.queue.length;
    const newCurrentTrack = player.queue.current?.title || 'Unknown';
    console.log(`[Rainlink] After skip - queue length: ${newQueueLength}, current: ${newCurrentTrack}, playing: ${player.playing}`);
    
    // If queue is empty after skip, let user know
    if (newQueueLength === 0 && !player.playing) {
      return void message.channel.send(buildEmbed('Skipped', 'Skipped current track. Queue is now empty.', 'skip'));
    }
    
    return void message.channel.send(buildEmbed('Skipped', `Skipped to: ${newCurrentTrack}`, 'skip'));
  }

  if (command === 'clear') {
    // Fast voice channel check
    const voiceChannel = message.member?.voice?.channel;
    if (voiceChannel && player.voiceId && voiceChannel.id !== player.voiceId) {
      return void message.reply('You need to be in the same voice channel as the bot.');
    }
    
    const queueLength = player.queue.length;
    const hadCurrentTrack = !!player.queue.current;
    
    if (queueLength === 0 && !hadCurrentTrack) {
      return void message.channel.send(buildEmbed('Clear Queue', 'The queue is already empty.', 'queue'));
    }
    
    // Clear the queue and stop current track
    player.queue.clear(true); // true = also stop/clear current track
    
    // Prepare response text
    const clearedText = hadCurrentTrack && queueLength > 0 
      ? `Stopped current track and cleared ${queueLength} track${queueLength === 1 ? '' : 's'} from the queue.`
      : hadCurrentTrack 
      ? 'Stopped current track and cleared the queue.'
      : `Cleared ${queueLength} track${queueLength === 1 ? '' : 's'} from the queue.`;
    
    // Send response immediately, then stop playback in background
    message.channel.send(buildEmbed('Queue Cleared', clearedText, 'queue')).catch(() => {});
    
    // Stop playback if something was playing (non-blocking)
    if (hadCurrentTrack || player.playing) {
      player.stop(false).catch(error => {
        console.error('[Rainlink] Error stopping current track:', error.message);
      });
    }
  }

  if (command === 'stop') {
    // Fast voice channel check (avoid cache lookup if not needed)
    const voiceChannel = message.member?.voice?.channel;
    if (voiceChannel && player.voiceId && voiceChannel.id !== player.voiceId) {
      return void message.reply('You need to be in the same voice channel as the bot.');
    }
    // Send response immediately, then cleanup in background
    message.channel.send(buildEmbed('Stopped', 'Stopped playback and cleared the queue.', 'stop')).catch(() => {});
    
    // Do cleanup asynchronously (non-blocking)
    (async () => {
      try {
        player.queue.clear(true);
        await player.stop(true);
        player.disconnect();
        await rainlink.destroy(message.guild.id);
      } catch (error) {
        console.error('[Rainlink] Error during stop cleanup:', error.message);
      }
    })();
  }

  if (command === 'dc' || command === 'disconnect') {
    // Fast voice channel check
    const voiceChannel = message.member?.voice?.channel;
    if (voiceChannel && player.voiceId && voiceChannel.id !== player.voiceId) {
      return void message.reply('You need to be in the same voice channel as the bot.');
    }
    if (player.state !== 0) { // 0 = CONNECTED
      return void message.reply('Bot is not connected to any voice channel.');
    }
    
    // Guard against duplicate execution - prevent multiple disconnect commands
    const guildId = message.guild.id;
    if (disconnectingGuilds.has(guildId)) {
      return; // Already processing disconnect
    }
    disconnectingGuilds.add(guildId);
    
    // Clear auto-disconnect timer and preloaded track immediately
    const timer = autoDisconnectTimers.get(guildId);
    if (timer) {
      clearTimeout(timer);
      autoDisconnectTimers.delete(guildId);
    }
    preloadedTracks.delete(guildId);
    
    // Send response immediately, then disconnect in background
    message.channel.send(buildEmbed('Disconnected', 'Bot has been disconnected from the voice channel.', 'stop')).catch(() => {});
    
    // Do disconnect asynchronously (non-blocking)
    (async () => {
      try {
        // Only disconnect the player from voice channel
        // Use a check to ensure player still exists
        const currentPlayer = rainlink.players.get(guildId);
        if (currentPlayer && currentPlayer.state === 0) {
          currentPlayer.disconnect();
          // Small delay to ensure disconnect completes
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Only destroy player after disconnect is complete
        // Use a check to prevent errors if already destroyed
        const stillExists = rainlink.players.get(guildId);
        if (stillExists) {
          await rainlink.destroy(guildId);
        }
      } catch (error) {
        console.error('[Rainlink] Error during disconnect cleanup:', error.message);
      } finally {
        // Remove from disconnecting set after a short delay
        setTimeout(() => {
          disconnectingGuilds.delete(guildId);
        }, 1000);
      }
    })();
  }

  if (command === 'pause') {
    // Fast voice channel check
    const voiceChannel = message.member?.voice?.channel;
    if (voiceChannel && player.voiceId && voiceChannel.id !== player.voiceId) {
      return void message.reply('You need to be in the same voice channel as the bot.');
    }
    // Send response immediately, pause in background
    message.channel.send(buildEmbed('Paused', 'Playback paused.', 'pause')).catch(() => {});
    player.setPause(true).catch(error => {
      console.error('[Rainlink] Error pausing:', error.message);
    });
  }

  if (command === 'resume') {
    // Fast voice channel check
    const voiceChannel = message.member?.voice?.channel;
    if (voiceChannel && player.voiceId && voiceChannel.id !== player.voiceId) {
      return void message.reply('You need to be in the same voice channel as the bot.');
    }
    
    // Check if actually paused
    if (!player.paused) {
      return void message.channel.send(buildEmbed('Resume', 'Playback is not paused.', 'resume'));
    }
    
    // Resume playback
    await player.setPause(false);
    
    // Send response immediately - verification happens async
    message.channel.send(buildEmbed('Resumed', 'Playback resumed.', 'resume')).catch(() => {});
    
    // Verify it worked in background (non-blocking)
    setImmediate(() => {
      if (player.paused) {
        message.channel.send(buildEmbed('Resume Error', 'Failed to resume playback. Try using mm!play again.', 'resume')).catch(() => {});
      }
    });
  }

  if (command === 'queue') {
    const tracks = Array.from(player.queue); // Queue extends Array
    if (!tracks.length && !player.queue.current) return void message.channel.send(buildEmbed('Queue', 'Queue is empty.', 'queue'));
    const current = player.queue.current;
    let queueText = '';
    if (current) {
      queueText += `**▶️ Now Playing:** ${current.title} [${formatDuration(current.duration)}]\n\n`;
    }
    const preview = tracks.slice(0, 10).map((t, i) => `${i + 1}. ${t.title} [${formatDuration(t.duration)}]`).join('\n');
    queueText += preview + (tracks.length > 10 ? `\n...and ${tracks.length - 10} more` : '');
    const loopMode = player.loop === 'song' ? '🔁 Track' : player.loop === 'queue' ? '🔁 Queue' : '';
    if (loopMode) queueText += `\n\n${loopMode}`;
    return void message.channel.send(buildEmbed(`Queue — ${tracks.length} track${tracks.length === 1 ? '' : 's'}`, queueText, 'queue'));
  }

  if (command === 'np') {
    const current = player.queue.current;
    if (!current) return void message.channel.send(buildEmbed('Now Playing', 'Nothing is playing.', 'nowplaying'));
    
    // Build embed efficiently
    const embed = new EmbedBuilder()
      .setColor(0x8e7cc3)
      .setTitle('Now Playing')
      .setDescription(`🎵 **${current.title}**`)
      .setTimestamp();
    
    // Add fields (reuse duration calculation)
    const duration = formatDuration(current.duration);
    embed.addFields(
      { name: 'Duration', value: duration, inline: true },
      { name: 'Requested by', value: current.requester ? `<@${current.requester}>` : 'Unknown', inline: true }
    );
    
    // Handle thumbnail (YouTube or icon)
    let hasThumbnail = false;
    if (current.uri) {
      embed.setURL(current.uri);
      // Try to get YouTube thumbnail
      if ((current.uri.includes('youtube.com') || current.uri.includes('youtu.be')) && !hasThumbnail) {
        const videoId = current.uri.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
        if (videoId) {
          embed.setThumbnail(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
          hasThumbnail = true;
        }
      }
    }
    
    // Add icon if no thumbnail (cache lookup is fast now)
    const iconPath = getIconPathFor('nowplaying');
    if (iconPath && !hasThumbnail) {
      embed.setThumbnail('attachment://icon.png');
      return void message.channel.send({ embeds: [embed], files: [{ attachment: iconPath, name: 'icon.png' }] });
    }
    
    return void message.channel.send({ embeds: [embed] });
  }

  if (command === 'volume') {
    // Fast voice channel check
    const voiceChannel = message.member?.voice?.channel;
    if (voiceChannel && player.voiceId && voiceChannel.id !== player.voiceId) {
      return void message.reply('You need to be in the same voice channel as the bot.');
    }
    const n = Number(args[0]);
    if (Number.isNaN(n) || n < 0 || n > 100) return void message.reply('Volume must be 0-100');
    // Send response immediately, set volume in background
    message.channel.send(buildEmbed('Volume', `Set to ${n}%`, 'volume')).catch(() => {});
    player.setVolume(n).catch(error => {
      console.error('[Rainlink] Error setting volume:', error.message);
    });
  }

  if (command === 'shuffle') {
    if (!player.queue.length) {
      return void message.reply('Queue is empty. Nothing to shuffle.');
    }
    player.queue.shuffle();
    return void message.channel.send(buildEmbed('Shuffled', `Shuffled ${player.queue.length} track${player.queue.length === 1 ? '' : 's'} in the queue.`, 'queue'));
  }

  if (command === 'loop') {
    const mode = (args[0] || '').toLowerCase();
    if (!mode || !['off', 'track', 'queue'].includes(mode)) {
      const currentMode = player.loop === 'song' ? 'Track' : player.loop === 'queue' ? 'Queue' : 'Off';
      return void message.reply(`Current loop mode: **${currentMode}**. Use \`mm!loop <off|track|queue>\` to change.`);
    }
    
    if (mode === 'off') {
      player.setLoop('none');
      return void message.channel.send(buildEmbed('Loop', 'Loop disabled.', 'queue'));
    } else if (mode === 'track') {
      player.setLoop('song');
      return void message.channel.send(buildEmbed('Loop', 'Looping current track.', 'queue'));
    } else if (mode === 'queue') {
      player.setLoop('queue');
      return void message.channel.send(buildEmbed('Loop', 'Looping entire queue.', 'queue'));
    }
  }

  if (command === 'remove') {
    if (!player.queue.length) {
      return void message.reply('Queue is empty. Nothing to remove.');
    }
    const index = Number(args[0]);
    if (Number.isNaN(index) || index < 1 || index > player.queue.length) {
      return void message.reply(`Please provide a valid number between 1 and ${player.queue.length}.`);
    }
    const removedTrack = player.queue[index - 1];
    player.queue.remove(index - 1);
    return void message.channel.send(buildEmbed('Removed', `Removed: ${removedTrack.title}`, 'queue'));
  }

  if (command === 'seek') {
    const timeArg = args.join(' ');
    if (!timeArg) {
      return void message.reply('Please provide a timestamp (e.g., `1:30` or `90` seconds).');
    }
    
    // Parse time: support "1:30", "90", "1:30:45"
    let seconds = 0;
    const parts = timeArg.split(':').map(p => parseInt(p.trim()));
    if (parts.length === 1) {
      seconds = parts[0];
    } else if (parts.length === 2) {
      seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
      return void message.reply('Invalid time format. Use `mm:ss` or `hh:mm:ss` or just seconds.');
    }
    
    if (isNaN(seconds) || seconds < 0) {
      return void message.reply('Invalid time value.');
    }
    
    const currentTrack = player.queue.current;
    if (!currentTrack) {
      return void message.reply('No track is currently playing.');
    }
    const duration = currentTrack.duration;
    if (seconds * 1000 > duration) {
      return void message.reply(`Time exceeds track duration (${formatDuration(duration)}).`);
    }
    
    // Send response immediately, seek in background
    message.channel.send(buildEmbed('Seeked', `Jumped to ${formatDuration(seconds * 1000)}`, 'queue')).catch(() => {});
    player.seek(seconds * 1000).catch(error => {
      message.reply(`Failed to seek: ${error.message || 'Unknown error'}`).catch(() => {});
    });
  }
});

bot.login(TOKEN);


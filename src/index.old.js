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
const { Kazagumo } = require('kazagumo');
const { Connectors } = require('shoukaku');

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

// Parse Lavalink URL (host:port format)
// Format can be "hostname" or "hostname:port"
// If no port specified, defaults to 443 for secure (HTTPS) or 2333 for insecure (HTTP)
const urlParts = LAVALINK_URL.split(':');
const lavalinkHost = urlParts[0];
const lavalinkPort = urlParts[1] || (LAVALINK_SECURE ? '443' : '2333');
console.log(`[Config] Parsed Lavalink connection: ${lavalinkHost}:${lavalinkPort} (secure: ${LAVALINK_SECURE})`);

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

// Lavalink manager (Kazagumo) - will be initialized in bot ready event
let manager;

// Search cache for faster repeated searches
const searchCache = new Map();
const CACHE_MAX_AGE = 300000; // 5 minutes
const CACHE_MAX_SIZE = 100; // Max 100 cached searches

// Track preloading map (guildId -> preloaded track)
const preloadedTracks = new Map();

// Auto-disconnect tracking (guildId -> timeout)
const autoDisconnectTimers = new Map();
const AUTO_DISCONNECT_DELAY = 300000; // 5 minutes (300000ms)

// Icon path cache (commandName -> iconPath) - loaded once at startup
const iconCache = new Map();

// Spotify URL regex
const SPOTIFY_TRACK_RE = /^https?:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]+)(\?.*)?$/;
const SPOTIFY_PLAYLIST_RE = /^https?:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)(\?.*)?$/;
const SPOTIFY_ALBUM_RE = /^https?:\/\/open\.spotify\.com\/album\/([A-Za-z0-9]+)(\?.*)?$/;

// Convert Spotify URLs to YouTube searches using oEmbed (no auth needed)
async function resolveSpotifyToYouTube(spotifyUrl) {
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
    if (!res.ok) {
      console.error(`[Spotify] oEmbed failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log(`[Spotify] oEmbed response:`, JSON.stringify(data, null, 2));
    
    // oEmbed only gives us the title, not the artist
    // Extract track ID to get full info from Spotify Web API (no auth needed for public tracks)
    const trackId = spotifyUrl.match(/track\/([A-Za-z0-9]+)/)?.[1];
    if (trackId) {
      try {
        // Use Spotify's public API to get artist info
        const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (trackRes.ok) {
          const trackData = await trackRes.json();
          const artist = trackData.artists?.[0]?.name || '';
          const title = trackData.name || data.title || '';
          const fullTitle = artist ? `${artist} ${title}` : title;
          console.log(`[Spotify] Full title with artist: "${fullTitle}"`);
          return fullTitle;
        }
      } catch (apiError) {
        console.log(`[Spotify] Couldn't get artist from API, using oEmbed title only`);
      }
    }
    
    // Fallback to oEmbed title
    const title = (data?.title || '').replace(/\s*\(.*?\)\s*$/,'').trim();
    if (title) {
      console.log(`[Spotify] Resolved "${spotifyUrl}" → "${title}"`);
      return title;
    }
  } catch (e) {
    console.error(`[Spotify] oEmbed error:`, e.message);
  }
  return null;
}

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
  
  // Load icon cache at startup
  loadIconCache();
  
  console.log('[Kazagumo] Initializing Kazagumo...');
  console.log(`[Kazagumo] Connection details: ${lavalinkHost}:${lavalinkPort} (secure: ${LAVALINK_SECURE})`);
  
  // Initialize Kazagumo (like Music v2 bot)
  const Nodes = [{
    name: LAVALINK_NAME,
    url: `${lavalinkHost}:${lavalinkPort}`,
    auth: LAVALINK_PASSWORD,
    secure: LAVALINK_SECURE
  }];
  
  manager = new Kazagumo({
    defaultSearchEngine: 'youtube',
    send: (guildId, payload) => {
      const guild = bot.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    }
  }, new Connectors.DiscordJS(bot), Nodes);
  
  console.log(`[Kazagumo] Kazagumo initialized`);
  
  // Kazagumo event handlers (like Music v2 bot)
  manager.shoukaku.on('ready', (name) => {
    console.log(`[Kazagumo] ✅ Lavalink node "${name}" connected and ready`);
  });
  
  manager.shoukaku.on('error', (name, error) => {
    console.error(`[Kazagumo] Node "${name}" error:`, error);
  });
  
  manager.shoukaku.on('close', (name, code, reason) => {
    console.warn(`[Kazagumo] Node "${name}" closed. Code: ${code}, Reason: ${reason}`);
  });
  
  manager.shoukaku.on('disconnect', (name, count) => {
    console.warn(`[Kazagumo] Node "${name}" disconnected. Count: ${count}`);
  });

      // Rainlink event handlers
      rainlink.on('nodeConnect', (node) => {
        const nodeName = node?.name || node?.options?.name || 'Unknown';
        console.log(`[Rainlink] ✅ Connected to Lavalink node: ${nodeName}`);
      });

      rainlink.on('nodeDisconnect', (node, reason) => {
        const nodeName = node?.name || node?.options?.name || 'Unknown';
        console.warn(`[Rainlink] ⚠️ Disconnected from Lavalink node: ${nodeName} - Reason: ${reason}`);
        
        // If error 1011 (undefined user ID), ensure manager ID is set before reconnect
        if (reason === 1011 || reason === '1011') {
          console.warn(`[Rainlink] Error 1011 detected - verifying manager ID...`);
          if (bot.user && bot.user.id) {
            if (!rainlink.id || rainlink.id === 'undefined') {
              rainlink.id = bot.user.id;
              console.log(`[Rainlink] Manager ID set to: ${rainlink.id}`);
            } else {
              console.log(`[Rainlink] Manager ID already set: ${rainlink.id}`);
            }
          } else {
            console.error(`[Rainlink] ERROR: Bot user ID not available!`);
          }
        }
      });

      rainlink.on('nodeError', (node, error) => {
        console.error(`[Rainlink] Node ${node.name} error:`, error);
        // Handle JSON parsing errors from Lavalink (malformed exception payloads)
        if (error.message && error.message.includes('JSON')) {
          console.error(`[Rainlink] JSON parsing error (likely malformed exception payload from Lavalink):`, error.message);
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
        console.error(`[${player.guildId}] Track resolve error: ${track?.title || 'Unknown'} - ${error.message}`);
        const channel = bot.channels.cache.get(player.textId);
        if (channel) {
          channel.send(`❌ Playback error: ${error.message || 'Unknown error'}`).catch(() => {});
        }
      });

      // Handle track exception events
      rainlink.on('trackException', (player, track, exception) => {
        console.error(`[${player.guildId}] Track exception: ${track?.title || 'Unknown'}`);
        console.error(`[${player.guildId}] Exception:`, exception?.message || exception?.cause || 'Unknown');
        
        const channel = bot.channels.cache.get(player.textId);
        if (channel) {
          const errorMsg = exception?.message || exception?.cause || '';
          // Check if it's a sign-in error (happens with some Spotify/YouTube tracks)
          if (errorMsg.includes('Please sign in') || errorMsg.includes('requires login')) {
            const trackInfo = track?.title && track?.author ? `${track.title} ${track.author}` : (track?.title || 'this track');
            channel.send(`❌ Failed to play: **${track?.title || 'Unknown'}**\n\nTry searching by name instead: \`mm!play ${trackInfo}\``).catch(() => {});
          } else {
            channel.send(`❌ Failed to play: ${track?.title || 'Unknown track'}`).catch(() => {});
          }
        }
        
        // Skip to next track if available
        if (player.queue.length > 0) {
          setTimeout(() => {
            if (player.queue.length > 0 && !player.playing) {
              player.play().catch(err => {
                console.error(`[${player.guildId}] Error playing next track:`, err.message);
              });
            }
          }, 1000);
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
    let query = args.join(' ');
    if (!query) return void message.reply('Provide a YouTube/Spotify link or search text.');
    
    // Convert Spotify URLs to song titles (client-side, no server plugins needed)
    // Let Rainlink's defaultSearchEngine handle adding the ytsearch: prefix
    if (SPOTIFY_TRACK_RE.test(query) || SPOTIFY_ALBUM_RE.test(query)) {
      const spotifyTitle = await resolveSpotifyToYouTube(query);
      if (spotifyTitle) {
        // Just use the title - Rainlink will add ytsearch: prefix automatically
        query = `${spotifyTitle} audio`;
        console.log(`[Spotify] Converted to search: "${query}" (Rainlink will add ytsearch: prefix)`);
      } else {
        return void message.reply('❌ Failed to resolve Spotify URL. Try searching by song name instead.');
      }
    } else if (SPOTIFY_PLAYLIST_RE.test(query)) {
      return void message.reply('❌ Spotify playlists aren\'t supported yet. Try adding individual tracks.');
    }
    
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
      
      // Ensure Lavalink node is connected before proceeding
      const node = rainlink.nodes.get(LAVALINK_NAME) || rainlink.nodes.all()[0];
      if (!node) {
        return void message.reply('❌ No Lavalink node available. Please wait a moment for connection.');
      }
      
      // Check if node is connected (state 0 = Connected)
      if (node.state !== 0 || !node.online) {
        console.log(`[Rainlink] Node not connected yet (state: ${node.state}, online: ${node.online}), waiting...`);
        // Wait for node to connect (max 10 seconds)
        await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(), 10000);
          const checkInterval = setInterval(() => {
            if (node.state === 0 && node.online) {
              clearTimeout(timeout);
              clearInterval(checkInterval);
              resolve();
            }
          }, 200);
          
          rainlink.once('nodeConnect', () => {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            resolve();
          });
        });
        
        // Double-check connection after wait
        if (node.state !== 0 || !node.online) {
          return void message.reply('❌ Unable to connect to Lavalink server. Please try again in a moment.');
        }
        console.log(`[Rainlink] Node connected, proceeding with play command...`);
      }
      
      // Get or create player
      let player = rainlink.players.get(message.guild.id);
      
      // Use query as-is (Rainlink will add ytsearch: prefix via defaultSearchEngine if needed)
      let searchQuery = query;
      const isUrl = query.startsWith('http://') || query.startsWith('https://');
      
      if (!player) {
        player = await rainlink.create({
          guildId: message.guild.id,
          shardId: message.guild.shardId || 0,
          voiceId: voiceChannel.id,
          textId: message.channel.id,
          volume: 50,
          deaf: true
        });
        setupAutoDisconnect(message.guild.id, voiceChannel.id);
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } else if (player.voiceId !== voiceChannel.id) {
        player.setVoiceChannel(voiceChannel.id);
        setupAutoDisconnect(message.guild.id, voiceChannel.id);
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        setupAutoDisconnect(message.guild.id, voiceChannel.id);
      }
      
      // Search for the track (like Music v2 bot - simple and direct)
      let searchResult;
      try {
        console.log(`[Rainlink] Searching: "${searchQuery}"`);
        console.log(`[Rainlink] Player.search() requester:`, message.author.id);
        
        // Try the search
        searchResult = await player.search(searchQuery, { requester: message.author });
        
        console.log(`[Rainlink] Search completed. Type: ${searchResult?.type || 'unknown'}, Tracks: ${searchResult?.tracks?.length || 0}`);
        console.log(`[Rainlink] Full search result:`, JSON.stringify(searchResult, null, 2).substring(0, 500));
      } catch (searchError) {
        console.error(`[Rainlink] Search error:`, searchError);
        await message.reactions.removeAll().catch(() => {});
        return void message.reply(`Error loading track: ${searchError.message || 'Unknown error'}`);
      }

      await message.reactions.removeAll().catch(() => {});
      
      if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
        return void message.reply('❌ No results found! Try using a different search term.');
      }
      
      const result = searchResult;

      // Handle playlists vs single tracks
      if (result.type === 'PLAYLIST' && result.playlistName) {
        // Add all tracks from playlist to queue (skip first track - will be played directly)
        for (let i = 1; i < result.tracks.length; i++) {
          player.queue.add(result.tracks[i]);
        }
        
        const addedText = `Queued playlist: ${result.playlistName} (${result.tracks.length} tracks)`;
        
        // If player is not playing, start playback with first track
        if (!player.playing) {
          if (player.paused) {
            await player.setPause(false);
          }
          await player.play(result.tracks[0]);
        }
        
        return void message.channel.send(buildEmbed('Added to Queue', addedText, 'queue'));
      } else {
        // Add single track
        const track = result.tracks[0];
        const wasAlreadyPlaying = player.playing;
        
        if (player.playing) {
          player.queue.add(track);
        } else {
          await player.play(track);
        }
        
        if (wasAlreadyPlaying) {
          return void message.channel.send(buildEmbed('Added to Queue', `Queued: ${track.title || 'Unknown'}`, 'queue'));
        }
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
      
      // CRITICAL: Ensure Lavalink node is connected (cache node to avoid repeated lookups)
      let node = rainlink.nodes.get(LAVALINK_NAME);
      if (!node) {
        const allNodes = rainlink.nodes.all();
        node = allNodes[0];
      }
      if (!node) {
        return void message.reply('❌ No Lavalink node available. Please wait a moment for connection.');
      }
      
      if (node.state !== 0) {
        return void message.reply('❌ Lavalink node is not connected. Please wait a moment and try again.');
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
    // Clear auto-disconnect timer and preloaded track immediately
    const timer = autoDisconnectTimers.get(message.guild.id);
    if (timer) {
      clearTimeout(timer);
      autoDisconnectTimers.delete(message.guild.id);
    }
    preloadedTracks.delete(message.guild.id);
    
    // Send response immediately, then disconnect in background
    message.channel.send(buildEmbed('Disconnected', 'Bot has been disconnected from the voice channel.', 'stop')).catch(() => {});
    
    // Do disconnect asynchronously (non-blocking)
    (async () => {
      try {
        player.disconnect();
        await rainlink.destroy(message.guild.id);
      } catch (error) {
        console.error('[Rainlink] Error during disconnect cleanup:', error.message);
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

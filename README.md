# Mufflins Music Bot

A high-performance Discord music bot built with Discord.js and Rainlink, featuring instant command responses, multi-source search, and smart queue management.

## IMPORTANT: Lavalink Required!

This bot uses **Rainlink** (similar to Jockie Music's architecture) and **requires a Lavalink server** to work.

## Adding the Bot to Your Server

To invite Mufflins Music Bot to your Discord server, use this link:

**🔗 [Invite Mufflins Music Bot](https://discord.com/api/oauth2/authorize?client_id=1433640357169598568&permissions=3231744&scope=bot)**

The bot will request the following permissions:
- **Connect** — Join voice channels
- **Speak** — Play audio in voice channels
- **Send Messages** — Respond to commands
- **Embed Links** — Show rich embeds with song info
- **Read Message History** — Process commands in channels

**Note:** You need **Administrator** or **Manage Server** permissions in the Discord server to add bots.

### After Adding the Bot

1. Make sure the bot has permission to access your voice channel
2. Use `mm!join` to have the bot join your voice channel
3. Start playing music with `mm!play song name`

## Quick Setup (For Developers)

### Prerequisites
- Node.js 18+ (Node 20 recommended)
- Java 17+ (only if self-hosting Lavalink locally)
- Discord Bot Token

### Deployment Strategy

**For Railway Deployment (Recommended):**
1. Deploy bot from this repository to Railway
2. Deploy Lavalink from separate `lavalink-server` repository to Railway
3. Connect bot to your Lavalink service using Railway's internal networking

This approach eliminates rate-limiting issues and provides the best stability.

### Option 1: Use Public Lavalink (Easiest - but may have rate-limiting)

**Current Server (Serenetia):**
1. Create `.env` file:
```env
TOKEN=YOUR_DISCORD_BOT_TOKEN
PREFIX=mm!
LAVALINK_URL=lavalinkv4-id.serenetia.com:443
LAVALINK_PASSWORD=lavalink
LAVALINK_SECURE=true
LAVALINK_NAME=serenetia
```

**Alternative Public Servers** (if current server has issues):

**Option A - AjieDev's Free Lavalink:**
Check [AjieDev's GitHub](https://github.com/AjieDev/Free-Lavalink) for current connection details. Example:
```env
TOKEN=YOUR_DISCORD_BOT_TOKEN
PREFIX=mm!
LAVALINK_URL=lavalink.ajie.eu.org:443
LAVALINK_PASSWORD=ajieisajie
LAVALINK_SECURE=true
LAVALINK_NAME=ajiedev
```

**Option B - Find Current Servers:**
Visit [Lavalink List](https://lavainfo.netlify.app/) or check Discord communities for active public Lavalink servers.

**Important Notes:**
- Public servers may rate-limit if you make too many connection attempts
- If using Railway, consider self-hosting Lavalink to avoid rate-limiting issues
- Always check server status and usage policies before connecting

2. Install and run:
```bash
npm install
npm start
```

**For Railway Deployment:**
Update your Railway environment variables with the new server details instead of creating a `.env` file.

### Option 2: Self-Hosted Lavalink

**Option 2A: Local Self-Hosting**

1. Download Lavalink v4 from [GitHub Releases](https://github.com/lavalink-devs/Lavalink/releases)
2. Use `lavalink-server/application.yml` as your configuration
3. Run: `java -jar lavalink-server/Lavalink.jar`
4. Configure `.env` with:
```env
TOKEN=YOUR_DISCORD_BOT_TOKEN
PREFIX=mm!
LAVALINK_URL=localhost:2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false
LAVALINK_NAME=default
```
5. Run bot: `npm start`

**Option 2B: Deploy Lavalink on Railway (Recommended for Railway users)**

Deploy Lavalink as a separate Railway service to avoid public server rate-limiting. This is the **recommended solution** if you're experiencing disconnect issues with public servers.

### Method 1: Deploy from Separate GitHub Repo (Recommended)

1. **Create a new GitHub repository** for Lavalink:
   - Create a repo (e.g., `lavalink-server`)
   - Upload the contents of the `lavalink-server` directory from this project
   - See `lavalink-server/README.md` for detailed setup

2. **Deploy Lavalink service on Railway:**
   - Create new Railway project or add service to existing project
   - Select "Deploy from GitHub repo"
   - Choose your `lavalink-server` repository
   - Railway will auto-detect the service
   - **Start Command**: `java -jar Lavalink.jar` (set in Settings → Deploy)
   - Optional: Set `JAVA_OPTS=-Xmx512M` environment variable

3. **Get your Lavalink service URL:**
   - Wait for deployment to complete
   - Go to Settings → Networking
   - Copy the **Public Domain** URL (e.g., `lavalink-production.up.railway.app`)

4. **Update bot's Railway environment variables:**
   - Go to your bot service on Railway
   - Navigate to Variables tab
   - Update these variables:
     ```env
     LAVALINK_URL=<your-lavalink-service>.railway.app:443
     LAVALINK_PASSWORD=youshallnotpass
     LAVALINK_SECURE=true
     LAVALINK_NAME=railway-lavalink
     ```
   - Replace `<your-lavalink-service>` with your actual Railway service URL

### Method 2: Use Railway Internal Networking (Same Project)

If both services are in the **same Railway project**, you can use internal networking:

1. Deploy Lavalink service (from Method 1, steps 1-2)
2. Note your Lavalink service name (e.g., `lavalink`)
3. Update bot's environment variables:
   ```env
   LAVALINK_URL=lavalink:2333
   LAVALINK_PASSWORD=youshallnotpass
   LAVALINK_SECURE=false
   LAVALINK_NAME=railway-lavalink
   ```
   Replace `lavalink` with your actual service name

**Benefits:**
- ✅ No rate-limiting from public servers
- ✅ Full control over configuration
- ✅ Both services in same Railway project
- ✅ More stable and reliable
- ✅ Faster connection with internal networking
- ✅ No public exposure needed (if using internal networking)

**Cost**: Railway free tier includes $5/month credit - usually enough for both services!

## Commands

### Basic Playback
- **`mm!play`** or **`mm!p <url|search>`** — Play a song or search (supports YouTube, Spotify, SoundCloud)
- **`mm!join`** — Join your voice channel
- **`mm!skip`** — Skip current song
- **`mm!clear`** — Clear queue and stop current track
- **`mm!stop`** — Stop playback and disconnect
- **`mm!pause`** — Pause playback
- **`mm!resume`** — Resume playback

### Queue Management
- **`mm!queue`** — Show queue with track durations and loop mode
- **`mm!np`** — Show now playing with details and thumbnail
- **`mm!shuffle`** — Shuffle the queue
- **`mm!loop <off|track|queue>`** — Set loop mode (off, track, or queue)
- **`mm!remove <number>`** — Remove track from queue by position

### Playback Control
- **`mm!volume <0-100>`** — Set volume (0-100%)
- **`mm!seek <time>`** — Jump to timestamp (supports `1:30`, `90`, or `1:30:45` formats)

### Utility
- **`mm!dc`** or **`mm!disconnect`** — Disconnect bot from voice channel
- **`mm!status`** — Check Lavalink connection status
- **`mm!help`** — Show help message

## Features

### Performance Optimized
- **Instant command responses** — All commands respond immediately with background processing
- **Icon caching** — Icons loaded once at startup for lightning-fast embeds
- **Search caching** — Recent searches cached for 5 minutes (100 entry limit)
- **Track preloading** — Next track in queue preloaded for seamless transitions

### Smart Search
- **Multi-source search** — Automatically tries YouTube, then SoundCloud if no results
- **Plain text search** — Just type `mm!play song name` and it finds it
- **URL support** — Direct YouTube, Spotify, and SoundCloud links

### User Experience
- **Auto-disconnect** — Bot automatically disconnects after 5 minutes of inactivity
- **Queue notifications** — Only shows "Added to Queue" when adding songs to an existing queue
- **Queue empty notification** — Notifies when queue finishes
- **Custom icons** — Each command can have its own custom icon

### Queue Features
- **Smart queue management** — Prevents duplicate songs
- **Loop modes** — Loop current track, entire queue, or off
- **Shuffle support** — Randomize queue order
- **Track removal** — Remove any track by position

## Custom Icons

Place your custom icons in the `mufflins icons` folder. Icons are automatically matched to commands:

- `mufflins_play.png` → `mm!play` command
- `mufflins_skip.png` → `mm!skip` command
- `mufflins_queue.png` → Queue-related commands
- `mufflins_nowplaying.png` → `mm!np` command
- And more...

The bot will automatically find icons based on command names (case-insensitive, partial matches supported).

## Usage Examples

```bash
# Search and play a song
mm!play never gonna give you up
mm!p giveon dont leave

# Play from URL
mm!play https://www.youtube.com/watch?v=dQw4w9WgXcQ
mm!play https://open.spotify.com/track/...

# Queue management
mm!queue                    # Show queue
mm!shuffle                  # Shuffle queue
mm!loop queue               # Loop entire queue
mm!remove 3                # Remove 3rd track

# Playback control
mm!volume 75                # Set to 75%
mm!seek 1:30                # Jump to 1:30
mm!skip                     # Skip current song
mm!pause                    # Pause playback
mm!resume                   # Resume playback

# Utility
mm!join                     # Join voice channel
mm!clear                    # Clear queue and stop
mm!dc                       # Disconnect bot
```

## Technical Details

- **Framework**: Discord.js v14+
- **Music Library**: Rainlink (Lavalink client)
- **Audio Source**: Lavalink server (supports YouTube, Spotify, SoundCloud, etc.)
- **Performance**: Optimized with caching, preloading, and instant responses

## Notes

- Spotify tracks are resolved to YouTube equivalents via Lavalink
- The bot automatically handles voice channel permissions
- All commands are optimized for speed with instant feedback
- Search results are cached to reduce API calls
- The bot preloads the next track for seamless playback

## Credits

Built with:
- [Discord.js](https://discord.js.org/)
- [Rainlink](https://github.com/RainyLofi/Rainlink)
- [Lavalink](https://github.com/lavalink-devs/Lavalink)

---

**Enjoy your music!**

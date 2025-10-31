# Mufflins Music Bot

A high-performance Discord music bot built with Discord.js and Rainlink, featuring instant command responses, multi-source search, and smart queue management.

## IMPORTANT: Lavalink Required!

This bot uses **Rainlink** (similar to Jockie Music's architecture) and **requires a Lavalink server** to work.

## Quick Setup

### Prerequisites
- Node.js 18+ (Node 20 recommended)
- Java 17+ (only if self-hosting Lavalink)
- Discord Bot Token

### Option 1: Use Public Lavalink (Easiest)

1. Create `.env` file:
```env
TOKEN=YOUR_DISCORD_BOT_TOKEN
PREFIX=mm!
LAVALINK_URL=lavalinkv4-id.serenetia.com:443
LAVALINK_PASSWORD=lavalink
LAVALINK_SECURE=true
LAVALINK_NAME=serenetia
```

2. Install and run:
```bash
npm install
npm start
```

### Option 2: Self-Hosted Lavalink

**Quick steps:**
1. Download Lavalink v4 from [GitHub Releases](https://github.com/lavalink-devs/Lavalink/releases)
2. Create `application.yml` with your Lavalink configuration
3. Run: `java -jar Lavalink.jar`
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

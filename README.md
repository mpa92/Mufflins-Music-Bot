# 🎵 Mufflins Discord Music Bot

A powerful Discord music bot with the `mm!` prefix, featuring advanced playback controls and custom Mufflins branding!

## ✨ Features

- 🎵 High-quality music playback using Lavalink
- 🎮 Simple `mm!` prefix commands (case-insensitive: `mm!`, `Mm!`, `MM!` all work)
- 🎨 Custom Mufflins icons and branding
- 🔄 Autoplay mode
- ⏩ Advanced controls (forward, rewind, replay)
- 📊 Queue management
- 🔁 Loop modes (track & queue)
- 🔀 Shuffle support
- 🌐 Web dashboard API
- 🎯 **Supported Sources:** Spotify, YouTube, SoundCloud, Deezer

## 🎮 Commands

All commands use the `mm!` prefix (case-insensitive):

### 🎵 Music Commands
- `mm!play <song>` - Play a song or playlist (YouTube, Spotify, SoundCloud)
- `mm!skip` - Skip the current song
- `mm!pause` - Pause playback
- `mm!resume` - Resume playback
- `mm!stop` - Stop and clear queue
- `mm!queue` - Show the queue
- `mm!nowplaying` - Show current song
- `mm!volume <0-100>` - Set volume
- `mm!loop` - Toggle loop mode (track/queue/off)
- `mm!shuffle` - Shuffle the queue
- `mm!seek <time>` - Seek to position (e.g., `1:30` or `90` seconds)

### 🎶 Advanced Features
- `mm!autoplay` - Toggle autoplay mode (plays related songs)
- `mm!previous` - Play the previous track
- `mm!forward [seconds]` - Skip forward in track (default: 10s)
- `mm!rewind [seconds]` - Go back in track (default: 10s)
- `mm!replay` - Restart current track from beginning
- `mm!remove <#>` - Remove a track from queue by position
- `mm!clear` - Clear the queue (also stops current track)

### 📚 Other Commands
- `mm!help` - Show all commands
- `mm!ping` - Check bot latency
- `mm!join` - Join voice channel
- `mm!leave` - Leave voice channel

## 🚀 Quick Start

### Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Create a `.env` file:
   ```env
   TOKEN=your_discord_bot_token
   LAVALINK_HOST=localhost
   LAVALINK_PORT=2333
   LAVALINK_PASSWORD=youshallnotpass
   LAVALINK_SECURE=false
   
   # Optional - for better Spotify support
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   ```

3. **Start Lavalink Server**
   ```bash
   cd lavalink-server
   java -jar Lavalink.jar
   ```

4. **Start the Bot**
   ```bash
   npm start
   ```

### Railway Deployment

1. **Deploy Lavalink Server**
   - See `lavalink-server/README.md` for Railway deployment
   - Get the public domain URL from Railway

2. **Deploy Music Bot**
   - Deploy from GitHub
   - Set environment variables:
     ```env
     TOKEN=your_discord_bot_token
     LAVALINK_HOST=your-lavalink-service.up.railway.app
     LAVALINK_PORT=443
     LAVALINK_PASSWORD=youshallnotpass
     LAVALINK_SECURE=true
     ```

3. **Test in Discord**
   - Bot should show online
   - Try: `mm!play never gonna give you up`

## 📁 Project Structure

```
mufflins-discord-bot/
├── src/
│   ├── prefix/              # All mm! prefix commands
│   │   ├── music/          # Music commands (play, skip, pause, etc.)
│   │   └── other/          # Utility commands (help, ping)
│   ├── events/             # Discord events (playerStart, playerEnd, etc.)
│   ├── functions/          # Command handlers
│   ├── helpers/            # Helper functions (formatting, icons)
│   └── index.js            # Main bot file
├── lavalink-server/        # Lavalink server files
│   ├── Lavalink.jar        # Server executable
│   ├── application.yml     # Server configuration
│   ├── plugins/            # Plugin JAR files
│   └── README.md           # Lavalink setup guide
├── mufflins icons/         # Custom bot icons (optional)
├── server.js               # Web API server
├── config.json             # Lavalink fallback config
├── package.json
└── .env                    # Bot token & credentials
```

## 🎨 Custom Icons

Place your custom Mufflins icons in the `mufflins icons/` folder. The bot will automatically use them when available!

Supported icon names:
- `play`, `pause`, `skip`, `queue`, `nowplaying`, `help`, etc.

## 🌐 Web Dashboard

The bot includes a web server with API endpoints:
- Player status
- Queue management
- Search functionality
- Playback controls

Access at: `http://localhost:3000`

## 📝 Requirements

- **Node.js** 20.x or higher
- **Java** 17+ (for Lavalink server)
- **Discord bot token**
- **Lavalink server** (included in `lavalink-server/` folder)

## 🎵 Music Features

- **Multiple Sources:** YouTube, Spotify, SoundCloud, Deezer
- **High-quality audio** streaming via Lavalink
- **Queue management** with pagination
- **Loop modes:** Single track or entire queue
- **Volume control** (0-100%)
- **Seek functionality** (jump to any position)
- **Autoplay** related songs
- **Shuffle** queue order
- **Playlist support** (YouTube, Spotify)

## 🛠️ Technologies

- **discord.js** - Discord API wrapper
- **Kazagumo** - Music player manager
- **Shoukaku** - Lavalink client
- **Lavalink** - Audio streaming server
- **Express** - Web server
- **Node.js** - Runtime environment

## 🔧 Configuration

### Lavalink Connection

The bot connects to Lavalink using:
1. Environment variables (`.env`) - **recommended**
2. Fallback to `config.json`

### Spotify Support

For best Spotify experience, add to `.env`:
```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

Get credentials from: https://developer.spotify.com/dashboard

## 📄 License

ISC

## 👨‍💻 Author

Mufflins

---

**Enjoy your music! 🎵**

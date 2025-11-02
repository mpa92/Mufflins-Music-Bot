# 🎵 Mufflins Discord Music Bot

A powerful Discord music bot with the `mm!` prefix, featuring advanced playback controls and custom Mufflins branding!

## ✨ Features

- 🎵 High-quality music playback using Lavalink
- 🎮 Simple `mm!` prefix commands
- 🎨 Custom Mufflins icons and branding
- 📝 Lyrics support
- 🔄 Autoplay mode
- ⏩ Advanced controls (forward, rewind, replay)
- 📊 Queue management with pagination
- 🔁 Loop modes (track & queue)
- 🔀 Shuffle support
- 🌐 Web dashboard API

## 🎮 Commands

All commands use the `mm!` prefix:

### 🎵 Music Commands
- `mm!play <song>` - Play a song or playlist
- `mm!skip` - Skip the current song
- `mm!pause` - Pause playback
- `mm!resume` - Resume playback
- `mm!stop` - Stop and clear queue
- `mm!queue` - Show the queue
- `mm!nowplaying` - Show current song with controls
- `mm!volume <0-100>` - Set volume
- `mm!loop` - Toggle loop mode for current track
- `mm!shuffle` - Shuffle the queue

### 🎶 Advanced Features
- `mm!lyrics [song]` - Get lyrics for current or specified song
- `mm!autoplay` - Toggle autoplay mode (plays related songs)
- `mm!previous` - Play the previous track
- `mm!forward [seconds]` - Skip forward in track (default: 10s)
- `mm!rewind [seconds]` - Go back in track (default: 10s)
- `mm!replay` - Restart current track from beginning

### 📚 Other Commands
- `mm!help` - Show all commands
- `mm!ping` - Check bot latency

## 🚀 Quick Start

### Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Create a `.env` file (copy from `.env.example`):
   ```env
   TOKEN=your_discord_bot_token
   LAVALINK_HOST=localhost
   LAVALINK_PORT=2333
   LAVALINK_PASSWORD=youshallnotpass
   LAVALINK_SECURE=false
   ```

3. **Configure Lavalink**
   Update `config.json` or use environment variables above

4. **Start the Bot**
   ```bash
   npm start
   ```

### Railway Deployment

**Deploy to Railway in 3 steps:**

1. **Deploy Lavalink Server** (from your [lavalink-server](https://github.com/mpa92/lavalink-server) repo)
   - Create new Railway project
   - Deploy from GitHub repo: `lavalink-server`
   - Set start command: `java -jar Lavalink.jar`
   - Add env var: `JAVA_OPTS=-Xmx512M`
   - Generate public domain and copy URL

2. **Deploy Music Bot** (from your [Mufflins-Music-Bot](https://github.com/mpa92/Mufflins-Music-Bot) repo)
   - Deploy from GitHub repo: `Mufflins-Music-Bot`
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
   - Try `mm!play never gonna give you up`

Bot auto-deploys on every push to GitHub!

## 📁 Project Structure

```
mufflins-discord-bot/
├── src/
│   ├── prefix/              # All mm! commands
│   │   ├── music/          # Music commands
│   │   └── other/          # Utility commands
│   ├── events/             # Discord events
│   ├── functions/          # Command handlers
│   ├── helpers/            # Helper functions
│   └── index.js            # Main bot file
├── mufflins icons/         # Custom bot icons
├── server.js               # Web API server
├── config.json             # Lavalink config
├── package.json
└── .env                    # Bot token
```

## 🎨 Custom Icons

Place your custom Mufflins icons in the `mufflins icons/` folder. The bot will automatically use them when available!

## 🌐 Web Dashboard

The bot includes a web server with API endpoints for:
- Player status
- Queue management
- Search functionality
- Playback controls

Access at: `http://localhost:3000`

## 📝 Requirements

- Node.js 20.x or higher
- A running Lavalink server
- Discord bot token

## 🎵 Music Features

- YouTube, SoundCloud, and Spotify support
- High-quality audio streaming
- Queue management
- Loop modes (single track or entire queue)
- Volume control
- Seek functionality
- Autoplay related songs
- Lyrics fetching

## 🛠️ Technologies

- **discord.js** - Discord API wrapper
- **Kazagumo** - Music player manager
- **Shoukaku** - Lavalink client
- **Express** - Web server
- **Node.js** - Runtime environment

## 📄 License

ISC

## 👨‍💻 Author

Mufflins

---

**Enjoy your music! 🎵**

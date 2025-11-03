# Railway Environment Variables for Mufflins Music Bot

Copy these environment variables to your Railway bot service:

## 🔑 Required Variables

**⚠️ IMPORTANT: Use Public Domain for WebSocket connections**

Internal networking in Railway can cause 404 errors with WebSocket connections. Use the public domain instead:

```
TOKEN=your_discord_bot_token_here
LAVALINK_HOST=lavalink-server-production-7beb.up.railway.app
LAVALINK_PORT=443
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=true
LAVALINK_NAME=railway-lavalink
```

**Note:** Railway's internal networking may not properly handle WebSocket upgrades, causing 404 errors. The public domain (HTTPS on port 443) is recommended for reliable WebSocket connections.

## 🎵 Optional Variables (for better Spotify support)

```
SPOTIFY_CLIENT_ID=c1508ebfbb1845adaab4e294679977df
SPOTIFY_CLIENT_SECRET=7b4a880641b34db381a27412ebf6cc53
```

## 📋 How to Add in Railway

1. Go to your **Mufflins Music Bot** service in Railway
2. Click **Variables** tab
3. Click **+ New Variable**
4. Add each variable one by one:
   - **Name:** `TOKEN`
   - **Value:** `your_discord_bot_token_here`
   - Click **Add**
5. Repeat for all variables above

## ✅ Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `TOKEN` | ✅ Yes | Your Discord bot token |
| `LAVALINK_HOST` | ✅ Yes | Lavalink service URL or service name |
| `LAVALINK_PORT` | ✅ Yes | 443 (public) or 2333 (internal) |
| `LAVALINK_PASSWORD` | ✅ Yes | Password from Lavalink config |
| `LAVALINK_SECURE` | ✅ Yes | `true` (public) or `false` (internal) |
| `LAVALINK_NAME` | ✅ Yes | Name identifier for Lavalink |
| `SPOTIFY_CLIENT_ID` | ❌ Optional | Spotify API client ID |
| `SPOTIFY_CLIENT_SECRET` | ❌ Optional | Spotify API client secret |

## 🔒 Security Note

⚠️ **Never commit your `.env` file to GitHub!** The `.gitignore` file already excludes it.

---

**After adding variables, Railway will automatically restart your service!** 🚀


# 🔧 Fixing Spotify Tracks Stopping at 30 Seconds

## 🔍 Root Cause

Your Spotify tracks stop at ~30 seconds because:

1. **LavaSrc mirrors Spotify → Deezer/SoundCloud**
2. **Stream URLs expire after 30 seconds** (temporary URLs)
3. **No automatic URL refresh** → Stream dies
4. **Lavalink buffers are too small** → Can't handle the gap

## ✅ Solution: Update Your Lavalink Configuration

Apply these changes to `lavalink-server/application.yml`:

### Change 1: Increase Buffers (Prevent Stream Interruptions)

```yaml
lavalink:
  server:
    password: "youshallnotpass"
    # CHANGED: Increased buffers for stream stability
    bufferDurationMs: 800  # Was: 400ms → Now: 800ms
    frameBufferDurationMs: 10000  # Was: 5000ms → Now: 10000ms (10 seconds)
    playerUpdateInterval: 5
    resamplingQuality: "HIGH"
    trackStuckThresholdMs: 20000  # NEW: Detect stuck tracks after 20s
```

### Change 2: Reorder Providers (SoundCloud First, YouTube Fallback)

```yaml
plugins:
  lavasrc:
    sources:
      spotify: true
    spotify:
      clientId: "c1508ebfbb1845adaab4e294679977df"
      clientSecret: "7b4a880641b34db381a27412ebf6cc53"
      countryCode: "US"
    # CHANGED: SoundCloud first (more reliable), YouTube as fallback
    providers:
      - 'scsearch:%QUERY%'   # SoundCloud search (most reliable)
      - 'dzisrc:%ISRC%'      # Deezer via ISRC
      - 'dzsearch:%QUERY%'   # Deezer search
      - 'ytsearch:%QUERY%'   # YouTube as final fallback (NEW!)
```

## 🚀 How to Apply

### **If Lavalink is on Railway (Separate Service):**

1. Go to Railway → Your Lavalink service
2. Open the file editor or connect via GitHub
3. Update `application.yml` with the changes above
4. Redeploy the Lavalink service
5. Then redeploy your Discord Bot

### **If Lavalink is Local:**

1. Edit `lavalink-server/application.yml`
2. Restart Lavalink: `java -jar Lavalink.jar`
3. Restart your Discord Bot

## 📊 Why This Works

1. **Larger Buffers (10 seconds)**: Gives Lavalink time to refresh stream URLs before running out of audio
2. **SoundCloud First**: More reliable streams than Deezer (fewer rate limits)
3. **YouTube Fallback in LavaSrc**: If SoundCloud/Deezer fail, LavaSrc will automatically try YouTube
4. **Track Stuck Detection**: Detects and handles frozen streams after 20 seconds

## 🎵 Expected Result

After applying these changes, Spotify tracks should:
- ✅ Play for their full duration (not stop at 30 seconds)
- ✅ Automatically fallback to YouTube if SoundCloud/Deezer fail
- ✅ Buffer more audio to handle stream URL refreshes
- ✅ Detect and recover from stuck streams

## 🔄 Combined with Bot-Side Retry

Your Discord Bot also has automatic YouTube retry (we just added), so you have **TWO layers of protection**:

1. **Layer 1 (Lavalink/LavaSrc)**: Tries SoundCloud → Deezer → YouTube
2. **Layer 2 (Discord Bot)**: If track ends early, automatically retries with YouTube

This gives you maximum reliability! 🎉

## 📝 Alternative: Disable Spotify Mirroring Entirely

If you want to **skip Spotify mirroring altogether** and use YouTube directly:

```yaml
plugins:
  lavasrc:
    sources:
      spotify: false  # Disable Spotify mirroring
```

Then all Spotify links will be rejected, and users must search by song name (which uses YouTube).

---

**Note**: Your bot's automatic YouTube retry is already live. These Lavalink changes will fix the root cause so fewer retries are needed!


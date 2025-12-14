module.exports = async (client, player) => {
    // Try to get track info from multiple sources
    const currentTrack = player.queue.current;
    const previousTrack = player.queue.previous;
    const track = currentTrack || previousTrack;
    
    const trackInfo = track ? `"${track.title}" by ${track.author}` : 'Unknown track';
    const trackLength = track?.length ? `(${Math.floor(track.length / 1000)}s)` : '';
    
    const loopMode = player.loop === 'track' ? 'track' : player.loop === 'queue' ? 'queue' : 'none';
    
    console.log(`[${player.guildId}] ⏹️  Track ended: ${trackInfo} ${trackLength}`);
    console.log(`[${player.guildId}] Queue status: ${player.queue.size} tracks remaining, playing: ${player.playing}, paused: ${player.paused}, loop: ${loopMode}`);
    
    // Log what should happen next based on loop mode and queue status
    if (loopMode === 'track') {
        console.log(`[${player.guildId}] 🔂 Loop mode: track - should replay current track`);
    } else if (loopMode === 'queue') {
        console.log(`[${player.guildId}] 🔁 Loop mode: queue - should continue to next track`);
    } else if (player.queue.size > 0) {
        console.log(`[${player.guildId}] ✅ Loop off - should advance to next track (${player.queue.size} remaining)`);
    } else {
        const autoplayStatus = player.data.get("autoplay") ? ' (autoplay enabled - should continue)' : '';
        console.log(`[${player.guildId}] 📭 Queue is now empty${autoplayStatus}`);
    }
};


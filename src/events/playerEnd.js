module.exports = async (client, player) => {
    // Try to get track info from multiple sources
    const currentTrack = player.queue.current;
    const previousTrack = player.queue.previous;
    const track = currentTrack || previousTrack;
    
    const trackInfo = track ? `"${track.title}" by ${track.author}` : 'Unknown track';
    const trackLength = track?.length ? `(${Math.floor(track.length / 1000)}s)` : '';
    
    console.log(`[${player.guildId}] ⏹️  Track ended: ${trackInfo} ${trackLength}`);
    console.log(`[${player.guildId}] Queue status: ${player.queue.size} tracks remaining, playing: ${player.playing}, paused: ${player.paused}`);
    
    // Kazagumo automatically handles playing the next track in queue
    // We just log the status here - no manual intervention needed
    if (player.queue.size > 0) {
        console.log(`[${player.guildId}] ✅ Next track should auto-play (${player.queue.size} remaining)`);
    } else {
        const autoplayStatus = player.data.get("autoplay") ? ' (autoplay enabled - should continue)' : '';
        console.log(`[${player.guildId}] 📭 Queue is now empty${autoplayStatus}`);
    }
};


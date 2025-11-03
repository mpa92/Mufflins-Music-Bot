module.exports = async (client, player) => {
    const currentTrack = player.queue.previous;
    console.log(`[${player.guildId}] Track ended${currentTrack ? `: "${currentTrack.title}"` : ''} (queue size: ${player.queue.size})`);
    
    // Kazagumo automatically handles playing the next track in queue
    // We just log the status here - no manual intervention needed
    if (player.queue.size > 0) {
        console.log(`[${player.guildId}] Next track will auto-play (${player.queue.size} tracks remaining)`);
    } else {
        console.log(`[${player.guildId}] Queue is now empty${player.data.get("autoplay") ? ' (autoplay will trigger)' : ''}`);
    }
};


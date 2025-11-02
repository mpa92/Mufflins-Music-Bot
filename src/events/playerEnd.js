module.exports = async (client, player) => {
    console.log(`[${player.guildId}] Track ended`);
    
    // Ensure next track plays automatically if queue has tracks
    // Kazagumo should handle this, but we'll ensure it happens
    if (player.queue.size > 0 && !player.playing && !player.paused) {
        setTimeout(async () => {
            try {
                // Double-check conditions before playing
                if (player.queue.size > 0 && !player.playing && !player.paused) {
                    console.log(`[${player.guildId}] Auto-playing next track from queue (${player.queue.size} tracks remaining)`);
                    await player.play();
                }
            } catch (err) {
                console.error(`[${player.guildId}] Error auto-playing next track:`, err?.message || err);
            }
        }, 500); // Small delay to ensure track is fully ended
    }
};


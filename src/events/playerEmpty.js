const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Helper to get Mufflins icon
function getMufflinsIcon(commandName) {
    const iconsDir = path.join(process.cwd(), 'mufflins icons');
    if (!fs.existsSync(iconsDir)) return null;
    
    const iconFile = fs.readdirSync(iconsDir).find(file => 
        file.toLowerCase().includes(commandName.toLowerCase())
    );
    
    return iconFile ? path.join(iconsDir, iconFile) : null;
}

module.exports = async (client, player) => {
    const channel = client.channels.cache.get(player.textId);
    if (!channel) return;

    // Double-check queue is actually empty (prevent false positives)
    if (player.queue.size > 0) {
        console.warn(`[${player.guildId}] playerEmpty event fired but queue has ${player.queue.size} tracks - ignoring`);
        return;
    }

    console.log(`[${player.guildId}] Queue is empty (verified: ${player.queue.size} tracks)`);

    // Check if autoplay is enabled - continue playing if so
    const autoplayEnabled = player.data.get("autoplay");
    if (autoplayEnabled && player.queue.current) {
        const currentTrack = player.queue.current;
        const identifier = player.data.get("identifier") || currentTrack.identifier;
        
        console.log(`[${player.guildId}] Autoplay is enabled - searching for next related track...`);
        
        try {
            let search = null;
            
            // Try YouTube radio for YouTube tracks
            if (currentTrack.uri && (currentTrack.uri.includes('youtube.com') || currentTrack.uri.includes('youtu.be'))) {
                const videoId = identifier || currentTrack.uri.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
                if (videoId) {
                    search = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;
                }
            }
            
            // Fallback to YouTube search for any track
            if (!search) {
                search = `ytsearch:${currentTrack.title} ${currentTrack.author}`;
            }
            
            const res = await player.search(search, { requester: player.data.get("requester") || { id: 'system' } });
            
            if (res.tracks.length > 0) {
                // Find a different track (skip first result as it's likely the current/previous track)
                const nextTrack = res.tracks.find(t => t.uri !== currentTrack.uri && t.identifier !== currentTrack.identifier) || res.tracks[0];
                
                if (nextTrack.uri !== currentTrack.uri) {
                    player.queue.add(nextTrack);
                    await player.play();
                    console.log(`[${player.guildId}] Autoplay: Added and started playing "${nextTrack.title}"`);
                    return; // Don't send queue empty message if autoplay continues
                }
            }
            
            console.warn(`[${player.guildId}] Autoplay: Could not find a different related track`);
        } catch (error) {
            console.error(`[${player.guildId}] Autoplay error:`, error?.message || error);
        }
    }

    // Send queue empty message only if autoplay didn't continue
    const embed = new EmbedBuilder()
        .setColor(0x8e7cc3) // Mufflins purple
        .setTitle('Queue Empty')
        .setDescription('The queue has finished. Add more songs with `mm!play`!')
        .setTimestamp();

    const iconPath = getMufflinsIcon('queue');
    
    try {
        if (iconPath) {
            embed.setThumbnail('attachment://icon.png');
            await channel.send({
                embeds: [embed],
                files: [{ attachment: iconPath, name: 'icon.png' }]
            });
        } else {
            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error sending queue empty message:', error);
    }
};


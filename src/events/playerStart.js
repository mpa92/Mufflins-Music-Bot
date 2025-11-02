const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

module.exports = async (client, player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (!channel) return;

    console.log(`[${player.guildId}] Now playing: ${track.title}`);

    // Get YouTube thumbnail
    let thumbnail = null;
    if (track.uri && (track.uri.includes('youtube.com') || track.uri.includes('youtu.be'))) {
        const videoId = track.uri.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
        if (videoId) {
            thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
    }

    const embed = new EmbedBuilder()
        .setColor(0x8e7cc3) // Mufflins purple
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${track.title}](${track.uri})**`)
        .addFields(
            { name: 'Author', value: track.author || 'Unknown', inline: true },
            { name: 'Duration', value: track.length ? new Date(track.length).toISOString().substr(11, 8).replace(/^00:/, '') : 'Unknown', inline: true }
        )
        .setTimestamp();

    if (thumbnail) {
        embed.setThumbnail(thumbnail);
    } else {
        // Use Mufflins icon if no thumbnail
        const iconPath = getMufflinsIcon('nowplaying');
        if (iconPath) {
            embed.setThumbnail('attachment://icon.png');
        }
    }

    // Control buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('previous')
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('pause')
                .setEmoji('⏸️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('skip')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('loop')
                .setEmoji('🔁')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('shuffle')
                .setEmoji('🔀')
                .setStyle(ButtonStyle.Success)
        );

    try {
        const iconPath = getMufflinsIcon('nowplaying');
        if (iconPath && !thumbnail) {
            await channel.send({
                embeds: [embed],
                components: [row],
                files: [{ attachment: iconPath, name: 'icon.png' }]
            });
        } else {
            await channel.send({ embeds: [embed], components: [row] });
        }
    } catch (error) {
        console.error('Error sending now playing message:', error);
    }
};


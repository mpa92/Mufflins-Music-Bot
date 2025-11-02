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

    console.log(`[${player.guildId}] Queue is empty`);

    const embed = new EmbedBuilder()
        .setColor(0x8e7cc3) // Mufflins purple
        .setTitle('Queue Empty')
        .setDescription('The queue has finished. Add more songs with `/play`!')
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


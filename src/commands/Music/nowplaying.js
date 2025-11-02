const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { convertTime } = require('../../helpers/convertTime');
const fs = require('fs');
const path = require('path');

function getMufflinsIcon(commandName) {
    const iconsDir = path.join(process.cwd(), 'mufflins icons');
    if (!fs.existsSync(iconsDir)) return null;
    const iconFile = fs.readdirSync(iconsDir).find(file => 
        file.toLowerCase().includes(commandName.toLowerCase())
    );
    return iconFile ? path.join(iconsDir, iconFile) : null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('🎵 Show the currently playing song'),

    async execute(interaction, client) {
        const player = client.manager.players.get(interaction.guild.id);

        if (!player || !player.queue.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`❌` | **Nothing is currently playing!**')],
                ephemeral: true
            });
        }

        const track = player.queue.current;
        
        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('🎵 Now Playing')
            .setDescription(`**[${track.title}](${track.uri})**`)
            .addFields(
                { name: 'Author', value: track.author || 'Unknown', inline: true },
                { name: 'Duration', value: convertTime(track.length), inline: true },
                { name: 'Requested by', value: track.requester ? `<@${track.requester.id}>` : 'Unknown', inline: true }
            )
            .setTimestamp();

        // Get YouTube thumbnail
        if (track.uri && (track.uri.includes('youtube.com') || track.uri.includes('youtu.be'))) {
            const videoId = track.uri.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
            if (videoId) {
                embed.setThumbnail(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
            }
        }

        const iconPath = getMufflinsIcon('nowplaying');
        if (iconPath && !embed.data.thumbnail) {
            embed.setThumbnail('attachment://icon.png');
            await interaction.reply({ embeds: [embed], files: [{ attachment: iconPath, name: 'icon.png' }] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    }
};


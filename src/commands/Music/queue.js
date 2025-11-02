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
        .setName('queue')
        .setDescription('📋 Show the current queue'),

    async execute(interaction, client) {
        const player = client.manager.players.get(interaction.guild.id);

        if (!player) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`❌` | **Nothing is currently playing!**')],
                ephemeral: true
            });
        }

        const queue = player.queue;
        const current = queue.current;

        if (!current && queue.size === 0) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`📋` | **Queue is empty!**')],
                ephemeral: true
            });
        }

        let queueText = '';
        
        if (current) {
            queueText += `**▶️ Now Playing:**\n[${current.title}](${current.uri}) - \`${convertTime(current.length)}\`\n\n`;
        }

        if (queue.size > 0) {
            queueText += `**📋 Up Next:**\n`;
            const tracks = Array.from(queue).slice(0, 10);
            tracks.forEach((track, i) => {
                queueText += `\`${i + 1}.\` [${track.title}](${track.uri}) - \`${convertTime(track.length)}\`\n`;
            });
            
            if (queue.size > 10) {
                queueText += `\n...and ${queue.size - 10} more tracks`;
            }
        }

        const totalDuration = Array.from(queue).reduce((acc, track) => acc + track.length, current ? current.length : 0);
        
        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle(`📋 Queue — ${queue.size} track${queue.size === 1 ? '' : 's'}`)
            .setDescription(queueText)
            .addFields({ 
                name: 'Total Duration', 
                value: convertTime(totalDuration), 
                inline: true 
            })
            .setFooter({ text: `Loop: ${player.loop === 'track' ? '🔁 Track' : player.loop === 'queue' ? '🔁 Queue' : 'Off'}` })
            .setTimestamp();

        const iconPath = getMufflinsIcon('queue');
        if (iconPath) {
            embed.setThumbnail('attachment://icon.png');
            await interaction.reply({ embeds: [embed], files: [{ attachment: iconPath, name: 'icon.png' }] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    }
};


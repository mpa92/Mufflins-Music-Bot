const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
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
        .setName('resume')
        .setDescription('▶️ Resume playback'),

    async execute(interaction, client) {
        const { channel } = interaction.member.voice;
        const player = client.manager.players.get(interaction.guild.id);

        if (!channel || !player || channel.id !== player.voiceId) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`🚫` | **You must be in the same voice channel as me!**')],
                ephemeral: true
            });
        }

        if (!player.paused) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`▶️` | **The player is already playing!**')],
                ephemeral: true
            });
        }

        player.pause(false);

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('Resumed')
            .setDescription('▶️ Playback resumed')
            .setTimestamp();

        const iconPath = getMufflinsIcon('resume');
        if (iconPath) {
            embed.setThumbnail('attachment://icon.png');
            await interaction.reply({ embeds: [embed], files: [{ attachment: iconPath, name: 'icon.png' }] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    }
};


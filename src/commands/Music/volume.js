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
        .setName('volume')
        .setDescription('🔊 Set the volume')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (0-100)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(100)),

    async execute(interaction, client) {
        const { channel } = interaction.member.voice;
        const player = client.manager.players.get(interaction.guild.id);
        const volume = interaction.options.getInteger('level');

        if (!channel || !player || channel.id !== player.voiceId) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`🚫` | **You must be in the same voice channel as me!**')],
                ephemeral: true
            });
        }

        player.setVolume(volume);

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('Volume')
            .setDescription(`🔊 Volume set to **${volume}%**`)
            .setTimestamp();

        const iconPath = getMufflinsIcon('volume');
        if (iconPath) {
            embed.setThumbnail('attachment://icon.png');
            await interaction.reply({ embeds: [embed], files: [{ attachment: iconPath, name: 'icon.png' }] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    }
};


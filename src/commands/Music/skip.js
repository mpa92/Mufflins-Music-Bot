const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('⏭️ Skip the current song'),

    async execute(interaction, client) {
        const { channel } = interaction.member.voice;
        const player = client.manager.players.get(interaction.guild.id);

        if (!channel) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🚫` | **You must be in a voice channel to use this command!**')
                ],
                ephemeral: true
            });
        }

        if (!player) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **Nothing is currently playing!**')
                ],
                ephemeral: true
            });
        }

        if (channel.id !== player.voiceId) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🚫` | **You must be in the same voice channel as me!**')
                ],
                ephemeral: true
            });
        }

        if (!player.queue.size && !player.queue.current) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **Nothing is currently playing!**')
                ],
                ephemeral: true
            });
        }

        const currentTrack = player.queue.current?.title || 'Unknown';
        player.skip();

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('Skipped')
            .setDescription(`⏭️ Skipped: **${currentTrack}**`)
            .setTimestamp();

        const iconPath = getMufflinsIcon('skip');
        if (iconPath) {
            embed.setThumbnail('attachment://icon.png');
            await interaction.reply({ 
                embeds: [embed],
                files: [{ attachment: iconPath, name: 'icon.png' }]
            });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    }
};


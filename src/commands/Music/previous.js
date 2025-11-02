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
        .setName('previous')
        .setDescription('⏮️ Play the previous song in the queue'),

    async execute(interaction, client) {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player) return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setDescription('`🎶` **No song is currently playing in this guild!**')
            ],
            ephemeral: true
        });

        const { channel } = interaction.member.voice;
        if (!channel || interaction.member.voice.channel !== interaction.guild.members.me.voice.channel) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🚫` **I\'m not in the same voice channel as you!**')
                ],
                ephemeral: true
            });
        }

        const previous = player.getPrevious();
        if (!previous) return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setDescription('`⚠️` **No previous song found.**')
            ],
            ephemeral: true
        });

        await player.play(player.getPrevious(true));

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('🎵 Previous Song')
            .setDescription(`\`⏮️\` | *Now playing the previous song:*\n**[${previous.title}](${previous.uri})**`)
            .setThumbnail(previous.thumbnail || client.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: 'Enjoy your music! • Mufflins Music Bot', iconURL: interaction.user.displayAvatarURL() });

        return interaction.reply({ embeds: [embed] });
    }
};


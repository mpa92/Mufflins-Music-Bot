const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
        .setName('join')
        .setDescription('🎤 Join your voice channel'),

    async execute(interaction, client) {
        const { channel } = interaction.member.voice;

        if (!channel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`🚫` | **You must be in a voice channel!**')],
                ephemeral: true
            });
        }

        const permissions = channel.permissionsFor(interaction.guild.members.me);
        if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`🔒` | **I don\'t have permission to join/speak in your voice channel!**')],
                ephemeral: true
            });
        }

        const player = await client.manager.createPlayer({
            guildId: interaction.guild.id,
            textId: interaction.channel.id,
            voiceId: channel.id,
            volume: 50,
            deaf: true
        });

        // Start auto-disconnect timer if not playing anything
        if (!player.playing && !player.paused && player.queue.size === 0) {
            if (client.startAutoDisconnectTimer) {
                client.startAutoDisconnectTimer(interaction.guild.id);
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('Joined')
            .setDescription(`🎤 Connected to <#${channel.id}>`)
            .setTimestamp();

        const iconPath = getMufflinsIcon('join');
        if (iconPath) {
            embed.setThumbnail('attachment://icon.png');
            await interaction.reply({ embeds: [embed], files: [{ attachment: iconPath, name: 'icon.png' }] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    }
};


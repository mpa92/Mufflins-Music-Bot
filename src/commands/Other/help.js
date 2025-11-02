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
        .setName('help')
        .setDescription('📖 Show all available commands'),

    async execute(interaction, client) {
        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('🎵 Mufflins Music Bot — Help')
            .setDescription('Here are all the available commands:\n**Prefix:** `mm!`')
            .addFields(
                {
                    name: '🎵 Music Commands',
                    value: [
                        '`mm!play <song>` — Play a song or playlist',
                        '`mm!skip` — Skip the current song',
                        '`mm!pause` — Pause playback',
                        '`mm!resume` — Resume playback',
                        '`mm!stop` — Stop and clear queue',
                        '`mm!queue` — Show the queue',
                        '`mm!nowplaying` — Show current song',
                        '`mm!volume <0-100>` — Set volume',
                        '`mm!loop` — Toggle loop mode',
                        '`mm!shuffle` — Shuffle the queue',
                        '`mm!seek` — Seek to a position',
                        '`mm!join` — Join voice channel',
                        '`mm!leave` — Leave voice channel'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🎶 Advanced Features',
                    value: [
                        '`mm!autoplay` — Toggle autoplay',
                        '`mm!previous` — Play previous track',
                        '`mm!forward [sec]` — Forward in track',
                        '`mm!rewind [sec]` — Rewind in track',
                        '`mm!replay` — Restart current track',
                        '`mm!remove <#>` — Remove a track',
                        '`mm!clear` — Clear the queue'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📚 Other Commands',
                    value: '`mm!help` — Show this help message\n`mm!ping` — Check bot latency',
                    inline: false
                }
            )
            .setFooter({ text: 'Mufflins Music Bot • Prefix: mm!', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        const iconPath = getMufflinsIcon('help');
        if (iconPath) {
            embed.setThumbnail('attachment://icon.png');
            await interaction.reply({ embeds: [embed], files: [{ attachment: iconPath, name: 'icon.png' }] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    }
};


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
            .setDescription('Here are all the available commands:\n**Slash Commands:** `/command`\n**Prefix Commands:** `mm!command`')
            .addFields(
                {
                    name: '🎵 Music Commands',
                    value: [
                        '`/play` — Play a song or playlist',
                        '`/skip` — Skip the current song',
                        '`/pause` — Pause playback',
                        '`/resume` — Resume playback',
                        '`/stop` — Stop and clear queue',
                        '`/queue` — Show the queue',
                        '`/nowplaying` — Show current song',
                        '`/volume` — Set volume (0-100)',
                        '`/shuffle` — Shuffle the queue',
                        '`/loop` — Toggle loop mode',
                        '`/loopqueue` — Loop entire queue',
                        '`/clear` — Clear the queue',
                        '`/remove` — Remove a track',
                        '`/seek` — Seek to a position',
                        '`/join` — Join voice channel',
                        '`/leave` — Leave voice channel'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🎶 Advanced Features',
                    value: [
                        '`/lyrics` — Get lyrics for song',
                        '`/autoplay` — Toggle autoplay',
                        '`/previous` — Play previous track',
                        '`/forward` — Forward in track',
                        '`/rewind` — Rewind in track',
                        '`/replay` — Restart current track',
                        '`/skipto` — Skip to position',
                        '`/move` — Move track position'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📚 Other Commands',
                    value: '`/help` — Show this help message\n`/ping` — Check bot latency',
                    inline: false
                }
            )
            .setFooter({ text: 'Mufflins Music Bot • Both / and mm! work!', iconURL: client.user.displayAvatarURL() })
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


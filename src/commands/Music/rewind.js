const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration } = require('../../helpers/formatDuration');
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

const rewindNum = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rewind')
        .setDescription('⏪ Rewind the currently playing song')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('How many seconds to rewind? (default is 10)')
                .setRequired(false)
                .setMinValue(1)
        ),

    async execute(interaction, client) {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player) return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setDescription('`🚫` **No music is currently playing in this guild!**')
            ],
            ephemeral: true
        });

        const { channel } = interaction.member.voice;
        if (!channel || interaction.member.voice.channel !== interaction.guild.members.me.voice.channel) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🔇` **I\'m not in the same voice channel as you!**')
                ],
                ephemeral: true
            });
        }

        const value = interaction.options.getInteger('seconds') || rewindNum;
        const currentPosition = player.position;

        if (currentPosition - value * 1000 >= 0) {
            await player.seek(currentPosition - value * 1000);

            const newDuration = formatDuration(currentPosition - value * 1000);
            const embed = new EmbedBuilder()
                .setDescription(`⏪ | *Rewound to:* \`${newDuration}\``)
                .setColor(0x8e7cc3)
                .setFooter({ text: 'Enjoy your music! 🎶 • Mufflins Music Bot' });

            return interaction.reply({ embeds: [embed] });
        } else {
            await player.seek(0);
            const embed = new EmbedBuilder()
                .setDescription(`⏪ | *Rewound to the beginning:* \`00:00\``)
                .setColor(0x8e7cc3)
                .setFooter({ text: 'Enjoy your music! 🎶 • Mufflins Music Bot' });

            return interaction.reply({ embeds: [embed] });
        }
    }
};


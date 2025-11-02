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
        .setName('move')
        .setDescription('🔄 Move a track to a different position in the queue')
        .addIntegerOption(option =>
            option.setName('from')
                .setDescription('Position of the track to move')
                .setRequired(true)
                .setMinValue(1))
        .addIntegerOption(option =>
            option.setName('to')
                .setDescription('Position to move the track to')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction, client) {
        const player = client.manager.players.get(interaction.guild.id);

        if (!player) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🎵` | **No music is currently playing!**')
                        .setFooter({ text: 'Use /play to start playing music' })
                ],
                ephemeral: true
            });
        }

        const { channel } = interaction.member.voice;
        if (!channel || interaction.member.voice.channel !== interaction.guild.members.me.voice.channel) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🚫` | **You must be in the same voice channel as me to use this command!**')
                        .setFooter({ text: 'Join my voice channel to use music commands' })
                ],
                ephemeral: true
            });
        }

        const from = interaction.options.getInteger('from') - 1;
        const to = interaction.options.getInteger('to') - 1;

        if (from >= player.queue.length || to >= player.queue.length) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **Invalid track position!**')
                        .setFooter({ text: `The queue only has ${player.queue.length} tracks` })
                ],
                ephemeral: true
            });
        }

        const track = player.queue[from];
        player.queue.splice(from, 1);
        player.queue.splice(to, 0, track);

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('`🔄` Track Moved')
            .setThumbnail(track.thumbnail || client.user.displayAvatarURL())
            .setDescription(`
\`➤\` **Track:** [${track.title}](${track.uri})
\`➤\` **Moved From:** Position ${from + 1}
\`➤\` **Moved To:** Position ${to + 1}
\`➤\` **Requested By:** ${interaction.user}
            `)
            .setFooter({ text: 'Use /queue to view the updated queue • Mufflins Music Bot' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};


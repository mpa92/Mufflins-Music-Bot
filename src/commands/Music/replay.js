const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { convertTime } = require('../../helpers/convertTime');
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
        .setName('replay')
        .setDescription('🔄 Replay the current track from the beginning'),

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

        const track = player.queue.current;
        if (!track) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **There is no track to replay!**')
                        .setFooter({ text: 'Use /play to add some tracks' })
                ],
                ephemeral: true
            });
        }

        await player.seek(0);

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('`🔄` Track Replaying')
            .setThumbnail(track.thumbnail || client.user.displayAvatarURL())
            .setDescription(`
\`➤\` **Track:** [${track.title}](${track.uri})
\`➤\` **Artist:** ${track.author}
\`➤\` **Duration:** ${convertTime(track.length)}
\`➤\` **Requested By:** ${interaction.user}

\`00:00 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ${convertTime(track.length)}\`
            `)
            .addFields([
                {
                    name: '`🎵` Track Info',
                    value: `Loop: ${player.loop === 'track' ? '`🔂` Track' : player.loop === 'queue' ? '`🔁` Queue' : '`❌` Off'} | Volume: ${player.volume}%`,
                    inline: false
                }
            ])
            .setFooter({ 
                text: 'Track started from the beginning • Mufflins Music Bot', 
                iconURL: interaction.user.displayAvatarURL() 
            })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};


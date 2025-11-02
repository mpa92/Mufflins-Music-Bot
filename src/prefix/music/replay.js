const { EmbedBuilder } = require('discord.js');
const { convertTime } = require('../../helpers/convertTime');
const { getMufflinsIcon } = require('../../helpers/iconHelper');

module.exports = {
    name: 'replay',
    aliases: ['restart'],
    description: 'Replay the current track from the beginning',
    usage: 'mm!replay',
    
    async execute(message, args, client) {
        const player = client.manager.players.get(message.guild.id);

        if (!player) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🎵` | **No music is currently playing!**')
                        .setFooter({ text: 'Use mm!play to start playing music' })
                ]
            });
        }

        const { channel } = message.member.voice;
        if (!channel || channel.id !== player.voiceId) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🚫` | **You must be in the same voice channel as me to use this command!**')
                        .setFooter({ text: 'Join my voice channel to use music commands' })
                ]
            });
        }

        const track = player.queue.current;
        if (!track) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **There is no track to replay!**')
                        .setFooter({ text: 'Use mm!play to add some tracks' })
                ]
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
\`➤\` **Requested By:** ${message.author}

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
                iconURL: message.author.displayAvatarURL() 
            })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};


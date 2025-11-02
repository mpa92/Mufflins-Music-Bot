const { EmbedBuilder } = require('discord.js');
const { convertTime } = require('../../helpers/convertTime');
const { getMufflinsIcon } = require('../../helpers/iconHelper');

module.exports = {
    name: 'nowplaying',
    aliases: ['np', 'current'],
    description: 'Show the currently playing song',
    usage: 'mm!nowplaying',
    
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

        const track = player.queue.current;
        if (!track) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **No track is currently playing!**')
                        .setFooter({ text: 'Use mm!play to add tracks' })
                ]
            });
        }

        const position = player.position;
        const duration = track.length;
        const progress = Math.floor((position / duration) * 20);
        const progressBar = '▬'.repeat(progress) + '🔘' + '▬'.repeat(20 - progress);

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('`🎵` Now Playing')
            .setDescription(`**[${track.title}](${track.uri})**\n\n\`${convertTime(position)} ${progressBar} ${convertTime(duration)}\``)
            .addFields([
                { name: '`👤` Author', value: track.author || 'Unknown', inline: true },
                { name: '`⏱️` Duration', value: convertTime(duration), inline: true },
                { name: '`🔊` Volume', value: `${player.volume}%`, inline: true },
                { name: '`🔁` Loop', value: player.loop === 'track' ? '`🔂` Track' : player.loop === 'queue' ? '`🔁` Queue' : '`❌` Off', inline: true },
                { name: '`📊` Queue', value: `${player.queue.length} tracks`, inline: true },
                { name: '`👥` Requested By', value: `${track.requester || 'Unknown'}`, inline: true }
            ])
            .setThumbnail(track.thumbnail || client.user.displayAvatarURL())
            .setFooter({ 
                text: 'Use mm!skip, mm!pause, mm!resume, mm!loop, mm!shuffle for controls • Mufflins Music Bot', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();

        const iconPath = getMufflinsIcon('nowplaying');
        if (iconPath && !embed.data.thumbnail) {
            embed.setThumbnail('attachment://icon.png');
            return message.reply({ 
                embeds: [embed], 
                files: [{ attachment: iconPath, name: 'icon.png' }]
            });
        }

        return message.reply({ embeds: [embed] });
    }
};


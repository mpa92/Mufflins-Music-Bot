const { EmbedBuilder } = require('discord.js');
const { getMufflinsIcon } = require('../../helpers/iconHelper');

module.exports = {
    name: 'skip',
    aliases: ['s'],
    description: 'Skip the current song',
    usage: 'mm!skip',
    
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
        if (!channel || message.member.voice.channel.id !== message.guild.members.me.voice.channel.id) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🚫` | **You must be in the same voice channel as me to use this command!**')
                        .setFooter({ text: 'Join my voice channel to use music commands' })
                ]
            });
        }

        if (player.queue.size === 0) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **There are no more tracks in the queue!**')
                        .setFooter({ text: 'The current track will finish playing' })
                ]
            });
        }

        player.skip();

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setDescription('`⏭️` | **Skipped the current track!**')
            .setFooter({ text: 'Mufflins Music Bot' });

        const iconPath = getMufflinsIcon('skip');
        if (iconPath) {
            embed.setThumbnail('attachment://icon.png');
            return message.reply({ 
                embeds: [embed],
                files: [{ attachment: iconPath, name: 'icon.png' }]
            });
        }

        return message.reply({ embeds: [embed] });
    }
};


const { EmbedBuilder } = require('discord.js');
const { getMufflinsIcon } = require('../../helpers/iconHelper');

module.exports = {
    name: 'leave',
    aliases: ['disconnect', 'dc'],
    description: 'Leave the voice channel',
    usage: 'mm!leave',
    
    async execute(message, args, client) {
        const player = client.manager.players.get(message.guild.id);

        if (!player) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🎵` | **I\'m not in a voice channel!**')
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

        player.destroy();

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setDescription('`👋` | **Left the voice channel!**')
            .setFooter({ text: 'Mufflins Music Bot' });

        const iconPath = getMufflinsIcon('stop'); // Using stop icon for leave
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


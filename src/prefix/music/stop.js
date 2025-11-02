const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stop',
    aliases: ['disconnect', 'dc'],
    description: 'Stop playing and clear the queue',
    usage: 'mm!stop',
    
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

        player.destroy();

        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setDescription('`⏹️` | **Stopped playing and cleared the queue!**')
                    .setFooter({ text: 'Mufflins Music Bot' })
            ]
        });
    }
};


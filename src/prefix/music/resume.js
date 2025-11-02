const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'resume',
    aliases: ['unpause'],
    description: 'Resume the paused song',
    usage: 'mm!resume',
    
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

        if (!player.paused) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`▶️` | **The music is not paused!**')
                        .setFooter({ text: 'Use mm!pause to pause the music' })
                ]
            });
        }

        player.pause(false);

        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setDescription('`▶️` | **Resumed the music!**')
                    .setFooter({ text: 'Mufflins Music Bot' })
            ]
        });
    }
};


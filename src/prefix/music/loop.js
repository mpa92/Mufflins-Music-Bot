const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'loop',
    aliases: ['repeat'],
    description: 'Toggle loop mode for the current track',
    usage: 'mm!loop',
    
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

        if (player.loop === 'track') {
            player.setLoop('none');
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🔁` | **Loop mode disabled!**')
                        .setFooter({ text: 'Mufflins Music Bot' })
                ]
            });
        } else {
            player.setLoop('track');
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🔂` | **Loop mode enabled for current track!**')
                        .setFooter({ text: 'Mufflins Music Bot' })
                ]
            });
        }
    }
};


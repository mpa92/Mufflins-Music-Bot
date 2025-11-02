const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'volume',
    aliases: ['vol', 'v'],
    description: 'Set the volume (0-100)',
    usage: 'mm!volume <0-100>',
    
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

        const volume = parseInt(args[0]);

        if (!args[0] || isNaN(volume)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription(`\`🔊\` | **Current volume:** ${player.volume}%`)
                        .setFooter({ text: 'Usage: mm!volume <0-100>' })
                ]
            });
        }

        if (volume < 0 || volume > 100) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **Volume must be between 0 and 100!**')
                        .setFooter({ text: 'Usage: mm!volume <0-100>' })
                ]
            });
        }

        player.setVolume(volume);

        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setDescription(`\`🔊\` | **Volume set to:** ${volume}%`)
                    .setFooter({ text: 'Mufflins Music Bot' })
            ]
        });
    }
};


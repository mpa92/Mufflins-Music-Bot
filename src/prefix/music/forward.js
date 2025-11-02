const { EmbedBuilder } = require('discord.js');
const { convertTime } = require('../../helpers/convertTime');
const { getMufflinsIcon } = require('../../helpers/iconHelper');

const fastForwardNum = 10; 

module.exports = {
    name: 'forward',
    aliases: ['ff', 'fastforward'],
    description: 'Forward the currently playing song',
    usage: 'mm!forward [seconds]',
    
    async execute(message, args, client) {
        const player = client.manager.players.get(message.guild.id);
        if (!player) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🚫` | **No music is currently playing in this guild!**')
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
                        .setDescription('`🔇` | **I\'m not in the same voice channel as you!**')
                ]
            });
        }

        const value = args[0] ? parseInt(args[0]) : fastForwardNum;
        if (isNaN(value) || value < 1) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **Please provide a valid number of seconds!**')
                ]
            });
        }

        const song = player.queue.current;
        if (!song) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **No track is currently playing!**')
                ]
            });
        }

        const currentPosition = player.position;

        if (currentPosition + value * 1000 < song.length) {
            await player.seek(currentPosition + value * 1000);

            const newDuration = convertTime(currentPosition + value * 1000);
            const embed = new EmbedBuilder()
                .setDescription(`\`⏭️\` | *Forwarded to:* \`${newDuration}\``)
                .setColor(0x8e7cc3)
                .setFooter({ text: 'Enjoy your music! 🎶 • Mufflins Music Bot' });

            return message.reply({ embeds: [embed] });
        } else {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`⚠️` | **You can\'t forward beyond the duration of the song!**')
                ]
            });
        }
    }
};


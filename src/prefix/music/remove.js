const { EmbedBuilder } = require('discord.js');
const { getMufflinsIcon } = require('../../helpers/iconHelper');

module.exports = {
    name: 'remove',
    aliases: ['rm', 'delete'],
    description: 'Remove a track from the queue',
    usage: 'mm!remove <position>',
    
    async execute(message, args, client) {
        const { channel } = message.member.voice;
        const player = client.manager.players.get(message.guild.id);

        if (!channel || !player || channel.id !== player.voiceId) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🚫` | **You must be in the same voice channel as me!**')
                ]
            });
        }

        if (!args[0]) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **Please provide a position number!**\n\nUsage: `mm!remove <position>`')
                ]
            });
        }

        const position = parseInt(args[0]);
        if (isNaN(position) || position < 1) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **Please provide a valid position number!**')
                ]
            });
        }

        if (position > player.queue.size) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription(`\`❌\` | **Invalid position! Queue has ${player.queue.size} tracks.**`)
                ]
            });
        }

        const queueArray = Array.from(player.queue);
        const removedTrack = queueArray[position - 1];
        player.queue.remove(position - 1);

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('🗑️ Removed')
            .setDescription(`**Removed:** [${removedTrack.title}](${removedTrack.uri})`)
            .setThumbnail(removedTrack.thumbnail || null)
            .setFooter({ text: `Position ${position} • Mufflins Music Bot` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};


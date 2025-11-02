const { EmbedBuilder } = require('discord.js');
const { getMufflinsIcon } = require('../../helpers/iconHelper');

module.exports = {
    name: 'clear',
    aliases: ['cl', 'purge'],
    description: 'Clear the queue',
    usage: 'mm!clear',
    
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

        const queueSize = player.queue.size;
        const wasPlaying = player.playing || player.queue.current;

        // Stop the current track if playing
        if (wasPlaying) {
            try {
                await player.stop();
            } catch (error) {
                console.error('[Clear] Error stopping track:', error);
            }
        }

        // Clear the queue
        player.queue.clear();

        // Build response message
        let description = '';
        if (queueSize === 0 && !wasPlaying) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **Queue is already empty and no track is playing!**')
                ]
            });
        } else if (queueSize === 0 && wasPlaying) {
            description = 'Stopped the current track. Queue was already empty.';
        } else if (queueSize > 0 && wasPlaying) {
            description = `Stopped the current track and cleared **${queueSize}** track${queueSize === 1 ? '' : 's'} from the queue`;
        } else {
            description = `Cleared **${queueSize}** track${queueSize === 1 ? '' : 's'} from the queue`;
        }

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('🗑️ Queue Cleared')
            .setDescription(description)
            .setFooter({ text: 'Mufflins Music Bot', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};


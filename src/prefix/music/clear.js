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

        // Clear the queue first (this removes all queued tracks)
        player.queue.clear();
        
        // Stop the current track if playing - destroy player to fully stop
        if (wasPlaying) {
            try {
                await player.destroy();
            } catch (error) {
                console.error('[Clear] Error stopping track:', error);
            }
        }

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


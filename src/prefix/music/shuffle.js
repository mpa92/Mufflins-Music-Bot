const { EmbedBuilder } = require('discord.js');
const { getMufflinsIcon } = require('../../helpers/iconHelper');

module.exports = {
    name: 'shuffle',
    aliases: ['sh'],
    description: 'Shuffle the queue',
    usage: 'mm!shuffle',
    
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

        if (player.queue.size === 0) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **Queue is empty!**')
                        .setFooter({ text: 'Add some songs to the queue first with mm!play' })
                ]
            });
        }

        // Shuffle the queue
        player.queue.shuffle();

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('🔀 Queue Shuffled')
            .setDescription(`Shuffled **${player.queue.size}** track${player.queue.size === 1 ? '' : 's'} in the queue`)
            .setFooter({ text: 'Mufflins Music Bot', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        const iconPath = getMufflinsIcon('shuffle');
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


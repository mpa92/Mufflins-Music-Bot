const { EmbedBuilder } = require('discord.js');
const { getMufflinsIcon } = require('../../helpers/iconHelper');

module.exports = {
    name: 'previous',
    aliases: ['prev', 'back'],
    description: 'Play the previous song in the queue',
    usage: 'mm!previous',
    
    async execute(message, args, client) {
        const player = client.manager.players.get(message.guild.id);
        if (!player) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🎶` | **No song is currently playing in this guild!**')
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
                        .setDescription('`🚫` | **I\'m not in the same voice channel as you!**')
                ]
            });
        }

        const previous = player.getPrevious();
        if (!previous) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`⚠️` | **No previous song found.**')
                ]
            });
        }

        await player.play(player.getPrevious(true));

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('🎵 Previous Song')
            .setDescription(`\`⏮️\` | *Now playing the previous song:*\n**[${previous.title}](${previous.uri})**`)
            .setThumbnail(previous.thumbnail || client.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: 'Enjoy your music! • Mufflins Music Bot', iconURL: message.author.displayAvatarURL() });

        return message.reply({ embeds: [embed] });
    }
};


const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getMufflinsIcon } = require('../../helpers/iconHelper');

module.exports = {
    name: 'join',
    aliases: ['j'],
    description: 'Join your voice channel',
    usage: 'mm!join',
    
    async execute(message, args, client) {
        const { channel } = message.member.voice;

        if (!channel) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🚫` | **You must be in a voice channel to use this command!**')
                        .setFooter({ text: 'Join a voice channel and try again' })
                ]
            });
        }

        const permissions = channel.permissionsFor(message.guild.members.me);
        if (!permissions.has(PermissionFlagsBits.Connect)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🔒` | **I don\'t have permission to join your voice channel!**')
                        .setFooter({ text: 'Please give me the "Connect" permission' })
                ]
            });
        }

        if (!permissions.has(PermissionFlagsBits.Speak)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🔇` | **I don\'t have permission to speak in your voice channel!**')
                        .setFooter({ text: 'Please give me the "Speak" permission' })
                ]
            });
        }

        try {
            let player = client.manager.players.get(message.guild.id);

            if (player && player.voiceId === channel.id) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x8e7cc3)
                            .setDescription('`🎵` | **I\'m already in your voice channel!**')
                    ]
                });
            }

            if (player && player.voiceId !== channel.id) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x8e7cc3)
                            .setDescription('`🚫` | **I\'m already connected to another voice channel!**')
                            .setFooter({ text: 'Use mm!leave first to disconnect me' })
                    ]
                });
            }

            player = await client.manager.createPlayer({
                guildId: message.guild.id,
                textId: message.channel.id,
                voiceId: channel.id,
                volume: 50,
                deaf: true
            });

            // Start auto-disconnect timer if not playing anything
            if (!player.playing && !player.paused && player.queue.size === 0) {
                if (client.startAutoDisconnectTimer) {
                    client.startAutoDisconnectTimer(message.guild.id);
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0x8e7cc3)
                .setDescription(`\`🎵\` | **Joined ${channel.name}!**`)
                .setFooter({ text: 'Use mm!play to start playing music • Mufflins Music Bot' });

            const iconPath = getMufflinsIcon('join');
            if (iconPath) {
                embed.setThumbnail('attachment://icon.png');
                return message.reply({ 
                    embeds: [embed],
                    files: [{ attachment: iconPath, name: 'icon.png' }]
                });
            }

            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Join Error:', error);
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **An error occurred while trying to join the channel!**')
                        .setFooter({ text: 'Please try again later' })
                ]
            });
        }
    }
};


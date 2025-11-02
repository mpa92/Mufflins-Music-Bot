const { EmbedBuilder } = require('discord.js');
const { convertTime } = require('../../helpers/convertTime');

module.exports = {
    name: 'play',
    aliases: ['p'],
    description: 'Play a song or playlist',
    usage: 'mm!play <song name or URL>',
    
    async execute(message, args, client) {
        const { channel } = message.member.voice;
        const query = args.join(' ');

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

        if (!query) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **Please provide a song name or URL!**')
                        .setFooter({ text: 'Usage: mm!play <song name or URL>' })
                ]
            });
        }

        const loadingMsg = await message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setDescription('`🔍` | **Searching...**')
            ]
        });

        try {
            let player = client.manager.players.get(message.guild.id);

            if (!player) {
                player = await client.manager.createPlayer({
                    guildId: message.guild.id,
                    textId: message.channel.id,
                    voiceId: channel.id,
                    volume: 50,
                    deaf: true
                });
            }

            if (player.voiceId !== channel.id) {
                return loadingMsg.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x8e7cc3)
                            .setDescription('`🚫` | **I am already connected to another voice channel!**')
                            .setFooter({ text: 'Join the same voice channel as me to control the music' })
                    ]
                });
            }

            const result = await player.search(query, message.author);

            if (!result.tracks.length) {
                return loadingMsg.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x8e7cc3)
                            .setDescription('`❌` | **No results found!**')
                            .setFooter({ text: 'Try using a different search term' })
                    ]
                });
            }

            if (result.type === 'PLAYLIST') {
                for (const track of result.tracks) {
                    track.requester = message.author;
                    player.queue.add(track);
                }

                const embed = new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setTitle('`📑` Playlist Added to Queue')
                    .setThumbnail(result.tracks[0].thumbnail)
                    .addFields([
                        {
                            name: '`🎵` Playlist Info',
                            value: `**Tracks:** ${result.tracks.length}`,
                            inline: false
                        },
                        {
                            name: '`📊` Queue Info',
                            value: `**Total Tracks:** ${player.queue.length}`,
                            inline: false
                        }
                    ])
                    .setFooter({
                        text: `Added by ${message.author.tag} • Mufflins Music Bot`,
                        iconURL: message.author.displayAvatarURL()
                    })
                    .setTimestamp();

                await loadingMsg.edit({ embeds: [embed] });
            } else {
                const track = result.tracks[0];
                track.requester = message.author;
                player.queue.add(track);

                const embed = new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setTitle('`🎵` Track Added to Queue')
                    .setDescription(`**[${track.title}](${track.uri})**\n\`➤\` **Duration:** ${convertTime(track.length)}\n\`➤\` **Author:** ${track.author}\n\`➤\` **Requested By:** ${message.author}`)
                    .addFields([
                        {
                            name: '`📊` Queue Position',
                            value: `#${player.queue.length}`,
                            inline: false
                        }
                    ])
                    .setFooter({
                        text: 'Track added successfully! 🎵 • Mufflins Music Bot',
                        iconURL: message.author.displayAvatarURL()
                    })
                    .setTimestamp();

                // Get YouTube thumbnail
                if (track.uri && (track.uri.includes('youtube.com') || track.uri.includes('youtu.be'))) {
                    const videoId = track.uri.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
                    if (videoId) {
                        embed.setThumbnail(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
                    }
                }

                await loadingMsg.edit({ embeds: [embed] });
            }

            if (!player.playing && !player.paused) {
                await player.play();
            }
        } catch (error) {
            console.error('Play Error:', error);
            return loadingMsg.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **An error occurred while trying to play the track!**')
                        .setFooter({ text: 'Please try again later' })
                ]
            });
        }
    }
};


const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { convertTime } = require('../../helpers/convertTime');
const fs = require('fs');
const path = require('path');

// Helper to get Mufflins icon
function getMufflinsIcon(commandName) {
    const iconsDir = path.join(process.cwd(), 'mufflins icons');
    if (!fs.existsSync(iconsDir)) return null;
    
    const iconFile = fs.readdirSync(iconsDir).find(file => 
        file.toLowerCase().includes(commandName.toLowerCase())
    );
    
    return iconFile ? path.join(iconsDir, iconFile) : null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('🎵 Play a song or playlist')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Song name, URL, or playlist URL')
                .setRequired(true)
                .setAutocomplete(true)),

    async autocomplete(interaction, client) {
        const focusedValue = interaction.options.getFocused();

        if (!focusedValue) {
            return interaction.respond([
                { name: "🎵 Start typing to search for a song...", value: "none" }
            ]);
        }

        try {
            const results = await client.manager.search(focusedValue);

            const tracks = results.tracks.slice(0, 10).map(track => ({
                name: `${track.author} - ${track.title.slice(0, 50)}${track.title.length > 50 ? '...' : ''}`,
                value: track.uri
            }));

            if (tracks.length === 0) {
                return interaction.respond([
                    { name: "❌ No results found", value: "none" }
                ]);
            }

            await interaction.respond(tracks);
        } catch (error) {
            console.error("Autocomplete error:", error);
            await interaction.respond([]);
        }
    },

    async execute(interaction, client) {
        const { channel } = interaction.member.voice;
        const query = interaction.options.getString('query');

        if (!channel) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🚫` | **You must be in a voice channel to use this command!**')
                        .setFooter({ text: 'Join a voice channel and try again' })
                ],
                ephemeral: true
            });
        }

        const permissions = channel.permissionsFor(interaction.guild.members.me);
        if (!permissions.has(PermissionFlagsBits.Connect)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🔒` | **I don\'t have permission to join your voice channel!**')
                        .setFooter({ text: 'Please give me the "Connect" permission' })
                ],
                ephemeral: true
            });
        }

        if (!permissions.has(PermissionFlagsBits.Speak)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🔇` | **I don\'t have permission to speak in your voice channel!**')
                        .setFooter({ text: 'Please give me the "Speak" permission' })
                ],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            let player = client.manager.players.get(interaction.guild.id);

            if (!player) {
                player = await client.manager.createPlayer({
                    guildId: interaction.guild.id,
                    textId: interaction.channel.id,
                    voiceId: channel.id,
                    volume: 50,
                    deaf: true
                });
            }

            if (player.voiceId !== channel.id) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x8e7cc3)
                            .setDescription('`🚫` | **I am already connected to another voice channel!**')
                            .setFooter({ text: 'Join the same voice channel as me to control the music' })
                    ],
                    ephemeral: true
                });
            }

            const result = await player.search(query, interaction.user);

            if (!result.tracks.length) {
                return interaction.editReply({
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
                    track.requester = interaction.user;
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
                        text: `Added by ${interaction.user.tag}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                const iconPath = getMufflinsIcon('play');
                if (iconPath) {
                    embed.setThumbnail('attachment://icon.png');
                    await interaction.editReply({ 
                        embeds: [embed],
                        files: [{ attachment: iconPath, name: 'icon.png' }]
                    });
                } else {
                    await interaction.editReply({ embeds: [embed] });
                }
            } else {
                const track = result.tracks[0];
                track.requester = interaction.user;
                player.queue.add(track);

                const embed = new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setTitle('`🎵` Track Added to Queue')
                    .setDescription(`**[${track.title}](${track.uri})**\n\`➤\` **Duration:** ${convertTime(track.length)}\n\`➤\` **Author:** ${track.author}\n\`➤\` **Requested By:** ${interaction.user}`)
                    .addFields([
                        {
                            name: '`📊` Queue Position',
                            value: `#${player.queue.length}`,
                            inline: false
                        }
                    ])
                    .setFooter({
                        text: 'Track added successfully! 🎵',
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                // Get YouTube thumbnail
                if (track.uri && (track.uri.includes('youtube.com') || track.uri.includes('youtu.be'))) {
                    const videoId = track.uri.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
                    if (videoId) {
                        embed.setThumbnail(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
                    }
                } else {
                    const iconPath = getMufflinsIcon('play');
                    if (iconPath) {
                        embed.setThumbnail('attachment://icon.png');
                    }
                }

                const iconPath = getMufflinsIcon('play');
                if (iconPath && !embed.data.thumbnail) {
                    embed.setThumbnail('attachment://icon.png');
                    await interaction.editReply({ 
                        embeds: [embed],
                        files: [{ attachment: iconPath, name: 'icon.png' }]
                    });
                } else {
                    await interaction.editReply({ embeds: [embed] });
                }
            }

            if (!player.playing && !player.paused) {
                await player.play();
            }
        } catch (error) {
            console.error('Play Error:', error);
            return interaction.editReply({
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


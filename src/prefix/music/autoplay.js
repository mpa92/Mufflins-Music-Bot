const { EmbedBuilder } = require('discord.js');
const { getMufflinsIcon } = require('../../helpers/iconHelper');

module.exports = {
    name: 'autoplay',
    aliases: ['ap'],
    description: 'Toggle autoplay mode (Randomly play related songs)',
    usage: 'mm!autoplay',
    
    async execute(message, args, client) {
        const player = client.manager.players.get(message.guild.id);
        if (!player) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription("`❌` | **No music is currently playing in this server!**")
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
                        .setDescription("`⚠️` | **You need to be in the same voice channel as me to use this command!**")
                ]
            });
        }

        if (player.data.get("autoplay")) {
            await player.data.set("autoplay", false);
            // Don't clear the queue when disabling autoplay - preserve user's manually queued tracks
            // If user wants to clear, they can use mm!clear manually
            console.log(`[${player.guildId}] Autoplay disabled - preserving ${player.queue.size} tracks in queue`);

            const embed = new EmbedBuilder()
                .setTitle("🎶 Autoplay Deactivated")
                .setDescription("`📻` | Autoplay has been **disabled**. No more random songs will be played after the current queue finishes.")
                .setColor(0x8e7cc3) 
                .setFooter({ text: 'Autoplay Off • Mufflins Music Bot', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        } else {
            // Autoplay: Use YouTube radio feature for related tracks
            const currentTrack = player.queue.current;
            if (!currentTrack) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x8e7cc3)
                            .setDescription("`⚠️` | **No track is currently playing!**")
                    ]
                });
            }

            // Try YouTube radio for any track (works with YouTube source enabled)
            const identifier = currentTrack.identifier;
            
            // For YouTube tracks, use YouTube radio
            if (currentTrack.uri && (currentTrack.uri.includes('youtube.com') || currentTrack.uri.includes('youtu.be'))) {
                const videoId = identifier || currentTrack.uri.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
                if (videoId) {
                    const search = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;
                    const res = await player.search(search, { requester: message.author });
                    if (!res.tracks.length) {
                        return message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0x8e7cc3)
                                    .setDescription("`⚠️` | **Autoplay is not supported for this track!**")
                            ]
                        });
                    }

                    await player.data.set("autoplay", true);
                    await player.data.set("requester", message.author);
                    await player.data.set("identifier", identifier);
                    await player.queue.add(res.tracks[1]);
                } else {
                    // Fallback to search-based autoplay
                    const search = `ytsearch:${currentTrack.title} ${currentTrack.author}`;
                    const res = await player.search(search, { requester: message.author });
                    if (res.tracks.length > 1) {
                        await player.data.set("autoplay", true);
                        await player.data.set("requester", message.author);
                        await player.data.set("identifier", identifier);
                        await player.queue.add(res.tracks[1]);
                    } else {
                        return message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0x8e7cc3)
                                    .setDescription("`⚠️` | **Could not find related tracks for autoplay!**")
                            ]
                        });
                    }
                }
            } else {
                // For non-YouTube tracks (Spotify, SoundCloud, etc.), use YouTube search
                const search = `ytsearch:${currentTrack.title} ${currentTrack.author}`;
                const res = await player.search(search, { requester: message.author });
                if (!res.tracks.length || res.tracks.length === 1) {
                    return message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x8e7cc3)
                                .setDescription("`⚠️` | **Could not find related tracks for autoplay!**")
                        ]
                    });
                }

                await player.data.set("autoplay", true);
                await player.data.set("requester", message.author);
                await player.data.set("identifier", identifier);
                // Add a different related track (skip the first one as it's likely the current track)
                await player.queue.add(res.tracks[1] || res.tracks[0]);
            }

            const embed = new EmbedBuilder()
                .setTitle("🎶 Autoplay Activated")
                .setDescription("`📻` | Autoplay has been **enabled**. Random songs will now continue to play after the current queue.")
                .setColor(0x8e7cc3) 
                .addFields(
                    { name: "`💽` Current Song", value: `[${player.queue.current.title}](${player.queue.current.uri})`, inline: true },
                    { name: "`👤` Requested by", value: `${message.author}`, inline: true }
                )
                .setThumbnail(player.queue.current.thumbnail || client.user.displayAvatarURL())
                .setFooter({ text: 'Autoplay On • Mufflins Music Bot', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }
    }
};


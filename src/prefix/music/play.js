const { EmbedBuilder } = require('discord.js');
const { convertTime } = require('../../helpers/convertTime');
const { getMufflinsIcon } = require('../../helpers/iconHelper');
require('dotenv').config();

// Spotify URL regex patterns
const SPOTIFY_TRACK_RE = /^https?:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]+)(\?.*)?$/;
const SPOTIFY_ALBUM_RE = /^https?:\/\/open\.spotify\.com\/album\/([A-Za-z0-9]+)(\?.*)?$/;
const SPOTIFY_PLAYLIST_RE = /^https?:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)(\?.*)?$/;

// YouTube URL regex patterns
const YOUTUBE_VIDEO_RE = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/i;
const YOUTUBE_PLAYLIST_RE = /^https?:\/\/(?:www\.)?youtube\.com\/(?:playlist|watch)\?.*[&?]list=([A-Za-z0-9_-]+)/i;
const YOUTUBE_MUSIC_RE = /^https?:\/\/music\.youtube\.com\/(?:watch|playlist)/i;

// Cache for Spotify access token
let spotifyTokenCache = {
    token: null,
    expiresAt: 0
};

// Get Spotify access token using client credentials
async function getSpotifyAccessToken() {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.log('[Spotify] No credentials found, using public API');
        return null;
    }

    // Return cached token if still valid
    if (spotifyTokenCache.token && Date.now() < spotifyTokenCache.expiresAt) {
        return spotifyTokenCache.token;
    }

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
            console.error(`[Spotify] Token request failed: ${response.status}`);
            return null;
        }

        const data = await response.json();
        spotifyTokenCache.token = data.access_token;
        spotifyTokenCache.expiresAt = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early
        console.log('[Spotify] Access token obtained');
        return spotifyTokenCache.token;
    } catch (error) {
        console.error('[Spotify] Token error:', error.message);
        return null;
    }
}

// Convert Spotify URLs to searchable queries
async function resolveSpotifyToSearch(spotifyUrl) {
    try {
        const trackId = spotifyUrl.match(/track\/([A-Za-z0-9]+)/)?.[1];
        if (!trackId) {
            return null;
        }

        // Try authenticated API first
        const accessToken = await getSpotifyAccessToken();
        if (accessToken) {
            try {
                const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    }
                });

                if (trackRes.ok) {
                    const trackData = await trackRes.json();
                    const artist = trackData.artists?.[0]?.name || '';
                    const title = trackData.name || '';
                    if (artist && title) {
                        // Add "audio" to prefer official audio tracks over music videos (which may have restrictions)
                        const searchQuery = `${artist} ${title} audio`;
                        console.log(`[Spotify] Converted "${spotifyUrl}" → "${searchQuery}"`);
                        return searchQuery;
                    }
                }
            } catch (apiError) {
                console.log(`[Spotify] Authenticated API error, trying fallback`);
            }
        }

        // Fallback to oEmbed (no auth required)
        const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
        if (oembedRes.ok) {
            const data = await oembedRes.json();
            const title = (data?.title || '').replace(/\s*\(.*?\)\s*$/, '').trim();
            if (title) {
                // Add "audio" to prefer official audio tracks
                const searchQuery = `${title} audio`;
                console.log(`[Spotify] oEmbed converted "${spotifyUrl}" → "${searchQuery}"`);
                return searchQuery;
            }
        }
    } catch (e) {
        console.error(`[Spotify] Conversion error:`, e.message);
    }
    return null;
}

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
            // Detect URL types
            let searchQuery = query;
            const isSpotifyTrack = SPOTIFY_TRACK_RE.test(query);
            const isSpotifyAlbum = SPOTIFY_ALBUM_RE.test(query);
            const isSpotifyPlaylist = SPOTIFY_PLAYLIST_RE.test(query);
            const isYouTubeVideo = YOUTUBE_VIDEO_RE.test(query);
            const isYouTubePlaylist = YOUTUBE_PLAYLIST_RE.test(query);
            const isYouTubeMusic = YOUTUBE_MUSIC_RE.test(query);
            
            // Handle YouTube URLs and playlists
            if (isYouTubeVideo || isYouTubePlaylist || isYouTubeMusic) {
                // Pass YouTube URL directly to Lavalink (YouTube source is enabled)
                searchQuery = query;
                if (isYouTubePlaylist) {
                    console.log(`[YouTube] Loading playlist: ${query}`);
                } else if (isYouTubeMusic) {
                    console.log(`[YouTube Music] Loading: ${query}`);
                } else {
                    console.log(`[YouTube] Loading video: ${query}`);
                }
            }
            // Handle Spotify tracks and playlists
            else if (isSpotifyTrack || isSpotifyPlaylist) {
                // Pass Spotify URL directly to Lavalink (LavaSrc will handle mirroring to Deezer/SoundCloud)
                searchQuery = query;
                if (isSpotifyPlaylist) {
                    console.log(`[Spotify] Loading playlist via LavaSrc: ${query}`);
                } else {
                    console.log(`[Spotify] Attempting direct playback via LavaSrc: ${query}`);
                }
            } else if (isSpotifyAlbum) {
                return loadingMsg.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x8e7cc3)
                            .setDescription('`❌` | **Spotify albums aren\'t supported yet!**\nTry adding individual tracks instead.')
                    ]
                });
            }

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

            // Search for the track (Spotify URLs will be mirrored by LavaSrc to Deezer/SoundCloud)
            let result = await player.search(searchQuery, message.author);

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

                // Determine playlist source and name
                let playlistName = result.playlistName || 'Playlist';
                let playlistDescription = `**${playlistName}**`;
                
                if (isSpotifyPlaylist) {
                    playlistDescription = `**${playlistName}** loaded via Spotify`;
                } else if (isYouTubePlaylist || isYouTubeMusic) {
                    playlistDescription = `**${playlistName}** loaded from YouTube`;
                }

                const embed = new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setTitle('`📑` Playlist Added to Queue')
                    .setDescription(playlistDescription)
                    .setThumbnail(result.tracks[0]?.thumbnail || null)
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
                    } else {
                        const iconPath = getMufflinsIcon('play');
                        if (iconPath) {
                            embed.setThumbnail('attachment://icon.png');
                        }
                    }
                }

                const iconPath = getMufflinsIcon('play');
                if (iconPath && !embed.data.thumbnail) {
                    embed.setThumbnail('attachment://icon.png');
                    await loadingMsg.edit({ 
                        embeds: [embed],
                        files: [{ attachment: iconPath, name: 'icon.png' }]
                    });
                } else {
                    await loadingMsg.edit({ embeds: [embed] });
                }
            }

        if (!player.playing && !player.paused) {
            try {
                await player.play();
            } catch (playError) {
                console.error('[Play] Error starting playback:', playError);
                await loadingMsg.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x8e7cc3)
                            .setDescription(`\`❌\` | **Failed to start playback!**\n\n${playError.message || 'Unknown error'}\n\nTry searching again or use a different source.`)
                    ]
                }).catch(() => {});
            }
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


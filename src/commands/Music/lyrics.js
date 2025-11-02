const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');
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
        .setName('lyrics')
        .setDescription('📝 Get lyrics for the current or specified song')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('Song name to search lyrics for')
                .setRequired(false)),

    async execute(interaction, client) {
        await interaction.deferReply();

        let query = interaction.options.getString('song');
        const player = client.manager.players.get(interaction.guild.id);

        // If no song specified, use current playing song
        if (!query && player?.queue?.current) {
            query = `${player.queue.current.title} ${player.queue.current.author}`.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
        }

        if (!query) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **Please provide a song name or play a song first!**')
                        .setFooter({ text: 'Use /lyrics <song name> or play a song first' })
                ]
            });
        }

        try {
            // Using lyrics-finder package (will be installed)
            const lyricsFinder = require('lyrics-finder');
            const lyrics = await lyricsFinder(query, "") || null;

            if (!lyrics) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x8e7cc3)
                            .setDescription('`❌` | **No lyrics found for this song!**')
                            .setFooter({ text: 'Try searching with a different song name' })
                    ]
                });
            }

            const thumbnail = player?.queue?.current?.thumbnail || null;

            // Split lyrics into chunks of 4096 characters (Discord's limit)
            const chunks = lyrics.match(/[\s\S]{1,4000}/g) || [];
            const pages = chunks.map((chunk, index) => {
                const embed = new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setTitle('`📝` Song Lyrics')
                    .setDescription(chunk)
                    .addFields([
                        {
                            name: '`🎵` Song Info',
                            value: `**Query:** ${query}`,
                            inline: false
                        }
                    ])
                    .setFooter({ 
                        text: `Page ${index + 1}/${chunks.length} • Mufflins Music Bot`, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTimestamp();
                
                if (thumbnail && index === 0) {
                    embed.setThumbnail(thumbnail);
                }
                
                return embed;
            });

            // If there's only one page, send it without buttons
            if (pages.length === 1) {
                return interaction.editReply({ embeds: [pages[0]] });
            }

            // Add pagination buttons
            let currentPage = 0;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('➡️')
                    .setDisabled(pages.length <= 1)
            );

            const message = await interaction.editReply({
                embeds: [pages[currentPage]],
                components: [row]
            });

            const collector = message.createMessageComponentCollector({
                time: 300000 // 5 minutes
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x8e7cc3)
                                .setDescription('`❌` | **These are not your lyrics!**')
                        ],
                        ephemeral: true
                    });
                }

                if (i.customId === 'prev_page') {
                    currentPage = Math.max(0, currentPage - 1);
                } else if (i.customId === 'next_page') {
                    currentPage = Math.min(pages.length - 1, currentPage + 1);
                }

                row.components[0].setDisabled(currentPage === 0);
                row.components[1].setDisabled(currentPage === pages.length - 1);

                await i.update({
                    embeds: [pages[currentPage]],
                    components: [row]
                });
            });

            collector.on('end', () => {
                row.components.forEach(button => button.setDisabled(true));
                message.edit({ components: [row] }).catch(() => {});
            });

        } catch (error) {
            console.error('Lyrics Error:', error);
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **An error occurred while fetching lyrics!**')
                        .setFooter({ text: 'Please try again later' })
                ]
            });
        }
    }
};


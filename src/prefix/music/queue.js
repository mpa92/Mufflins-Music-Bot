const { EmbedBuilder } = require('discord.js');
const { convertTime } = require('../../helpers/convertTime');
const { NormalPage } = require('../../helpers/pageQueue');
const { getMufflinsIcon } = require('../../helpers/iconHelper');

module.exports = {
    name: 'queue',
    aliases: ['q'],
    description: 'Show the music queue',
    usage: 'mm!queue',
    
    async execute(message, args, client) {
        const player = client.manager.players.get(message.guild.id);

        if (!player) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🎵` | **No music is currently playing!**')
                        .setFooter({ text: 'Use mm!play to start playing music' })
                ]
            });
        }

        const queue = player.queue;
        const current = player.queue.current;

        if (!current) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`❌` | **The queue is empty!**')
                        .setFooter({ text: 'Use mm!play to add tracks' })
                ]
            });
        }

        const queueLength = queue.length;
        const queueDuration = convertTime(queue.reduce((acc, track) => acc + track.length, 0) + current.length);

        const pages = [];
        const tracksPerPage = 10;

        // Current track embed
        const currentEmbed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('`🎵` Current Queue')
            .setDescription(`
**Now Playing:**
[${current.title}](${current.uri})
\`➤\` **Duration:** ${convertTime(current.length)}
\`➤\` **Author:** ${current.author}
\`➤\` **Requested By:** ${current.requester || 'Unknown'}

**Loop:** ${player.loop === 'track' ? '`🔂` Track' : player.loop === 'queue' ? '`🔁` Queue' : '`❌` Off'}
**Volume:** ${player.volume}%
            `)
            .setThumbnail(current.thumbnail || client.user.displayAvatarURL())
            .setTimestamp();

        const iconPath = getMufflinsIcon('queue');
        if (iconPath && !currentEmbed.data.thumbnail) {
            currentEmbed.setThumbnail('attachment://icon.png');
        }

        if (queue.length === 0) {
            currentEmbed.addFields({
                name: '`📑` Up Next',
                value: 'No tracks in queue',
                inline: false
            });
            
            if (iconPath && !currentEmbed.data.thumbnail) {
                return message.reply({ 
                    embeds: [currentEmbed],
                    files: [{ attachment: iconPath, name: 'icon.png' }]
                });
            }
            return message.reply({ embeds: [currentEmbed] });
        }

        pages.push(currentEmbed);

        // Queue pages
        for (let i = 0; i < queue.length; i += tracksPerPage) {
            const pageEmbed = new EmbedBuilder()
                .setColor(0x8e7cc3)
                .setTitle('`📑` Queue')
                .setDescription(
                    queue.slice(i, i + tracksPerPage).map((track, index) => 
                        `**${i + index + 1}.** [${track.title}](${track.uri}) - \`${convertTime(track.length)}\``
                    ).join('\n')
                )
                .setTimestamp();

            pages.push(pageEmbed);
        }

        if (pages.length === 1) {
            return message.reply({ embeds: [pages[0]] });
        }

        // Use pagination if multiple pages
        const reply = await message.reply({ embeds: [pages[0]] });
        await NormalPage(client, reply, pages, 300000, queueLength, queueDuration);
    }
};


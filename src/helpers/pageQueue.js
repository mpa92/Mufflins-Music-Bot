const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const NormalPage = async (client, message, pages, timeout, queueLength, queueDuration) => {
    if (!message && !message.channel) throw new Error('Channel is inaccessible.');
    if (!pages) throw new Error('Pages are not given.');

    // Styled buttons with Mufflins branding
    const prevButton = new ButtonBuilder()
        .setCustomId('back')
        .setLabel('⏪ Previous')
        .setStyle(ButtonStyle.Primary);

    const nextButton = new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next ⏩')
        .setStyle(ButtonStyle.Primary);

    const buttonRow = new ActionRowBuilder()
        .addComponents(prevButton, nextButton);

    let page = 0;

    // Initial page embed
    const curPage = await message.editReply({
        embeds: [pages[page].setFooter({
            text: `Page • ${page + 1}/${pages.length} | 📚 ${queueLength} Songs | ⏱️ ${queueDuration} Total Duration`
        })],
        components: [buttonRow],
        allowedMentions: { repliedUser: false }
    });

    if (pages.length === 0) return;

    const filter = (interaction) => interaction.user.id === message.user.id;
    const collector = await curPage.createMessageComponentCollector({ filter, time: timeout });

    collector.on('collect', async (interaction) => {
        if (!interaction.deferred) await interaction.deferUpdate();

        if (interaction.customId === 'back') {
            page = page > 0 ? --page : pages.length - 1;
        } else if (interaction.customId === 'next') {
            page = page + 1 < pages.length ? ++page : 0;
        }

        curPage.edit({
            embeds: [pages[page].setFooter({
                text: `Page • ${page + 1}/${pages.length} | 📚 ${queueLength} Songs | ⏱️ ${queueDuration} Total Duration`
            })],
            components: [buttonRow]
        });
    });

    collector.on('end', () => {
        // Disable buttons once time runs out
        const disabledButtons = new ActionRowBuilder()
            .addComponents(prevButton.setDisabled(true), nextButton.setDisabled(true));

        curPage.edit({
            embeds: [pages[page].setFooter({
                text: `Page • ${page + 1}/${pages.length} | 📚 ${queueLength} Songs | ⏱️ ${queueDuration} Total Duration`
            })],
            components: [disabledButtons]
        }).catch(() => {});
    });

    return curPage;
};

module.exports = { NormalPage };


const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('🏓 Check the bot\'s latency'),

    async execute(interaction, client) {
        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'Bot Latency', value: `${Date.now() - interaction.createdTimestamp}ms`, inline: true },
                { name: 'API Latency', value: `${Math.round(client.ws.ping)}ms`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};


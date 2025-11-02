const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('👋 Leave the voice channel'),

    async execute(interaction, client) {
        const { channel } = interaction.member.voice;
        const player = client.manager.players.get(interaction.guild.id);

        if (!channel || !player || channel.id !== player.voiceId) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`🚫` | **You must be in the same voice channel as me!**')],
                ephemeral: true
            });
        }

        player.destroy();

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('Left')
            .setDescription('👋 Disconnected from voice channel')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};


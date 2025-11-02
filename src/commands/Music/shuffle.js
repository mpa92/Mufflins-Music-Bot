const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('🔀 Shuffle the queue'),

    async execute(interaction, client) {
        const { channel } = interaction.member.voice;
        const player = client.manager.players.get(interaction.guild.id);

        if (!channel || !player || channel.id !== player.voiceId) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`🚫` | **You must be in the same voice channel as me!**')],
                ephemeral: true
            });
        }

        if (player.queue.size === 0) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`❌` | **Queue is empty!**')],
                ephemeral: true
            });
        }

        player.queue.shuffle();

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('Shuffled')
            .setDescription(`🔀 Shuffled **${player.queue.size}** tracks in the queue`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};


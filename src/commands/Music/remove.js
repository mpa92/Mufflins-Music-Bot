const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('🗑️ Remove a track from the queue')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('Position in queue to remove')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction, client) {
        const { channel } = interaction.member.voice;
        const player = client.manager.players.get(interaction.guild.id);
        const position = interaction.options.getInteger('position');

        if (!channel || !player || channel.id !== player.voiceId) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`🚫` | **You must be in the same voice channel as me!**')],
                ephemeral: true
            });
        }

        if (position > player.queue.size) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription(`\`❌\` | **Invalid position! Queue has ${player.queue.size} tracks.**`)],
                ephemeral: true
            });
        }

        const queueArray = Array.from(player.queue);
        const removedTrack = queueArray[position - 1];
        player.queue.remove(position - 1);

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('Removed')
            .setDescription(`🗑️ Removed: **${removedTrack.title}**`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};


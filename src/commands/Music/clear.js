const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('🗑️ Clear the queue'),

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
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`❌` | **Queue is already empty!**')],
                ephemeral: true
            });
        }

        const queueSize = player.queue.size;
        player.queue.clear();

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('Queue Cleared')
            .setDescription(`🗑️ Cleared **${queueSize}** track${queueSize === 1 ? '' : 's'} from the queue`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};


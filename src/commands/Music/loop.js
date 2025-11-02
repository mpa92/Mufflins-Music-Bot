const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('🔁 Set loop mode')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Loop mode')
                .setRequired(true)
                .addChoices(
                    { name: 'Off', value: 'none' },
                    { name: 'Track', value: 'track' },
                    { name: 'Queue', value: 'queue' }
                )),

    async execute(interaction, client) {
        const { channel } = interaction.member.voice;
        const player = client.manager.players.get(interaction.guild.id);
        const mode = interaction.options.getString('mode');

        if (!channel || !player || channel.id !== player.voiceId) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`🚫` | **You must be in the same voice channel as me!**')],
                ephemeral: true
            });
        }

        player.setLoop(mode);

        const modeText = mode === 'none' ? 'Off' : mode === 'track' ? '🔁 Track' : '🔁 Queue';
        
        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('Loop Mode')
            .setDescription(`Loop set to: **${modeText}**`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};


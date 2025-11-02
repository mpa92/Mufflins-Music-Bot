const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('⏩ Seek to a specific position in the track')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Time to seek to (e.g., 1:30 or 90)')
                .setRequired(true)),

    async execute(interaction, client) {
        const { channel } = interaction.member.voice;
        const player = client.manager.players.get(interaction.guild.id);
        const timeArg = interaction.options.getString('time');

        if (!channel || !player || channel.id !== player.voiceId) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`🚫` | **You must be in the same voice channel as me!**')],
                ephemeral: true
            });
        }

        if (!player.queue.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`❌` | **Nothing is currently playing!**')],
                ephemeral: true
            });
        }

        // Parse time: support "1:30", "90", "1:30:45"
        let seconds = 0;
        const parts = timeArg.split(':').map(p => parseInt(p.trim()));
        
        if (parts.length === 1) {
            seconds = parts[0];
        } else if (parts.length === 2) {
            seconds = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`❌` | **Invalid time format. Use `mm:ss` or `hh:mm:ss` or just seconds.**')],
                ephemeral: true
            });
        }

        if (isNaN(seconds) || seconds < 0) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription('`❌` | **Invalid time value.**')],
                ephemeral: true
            });
        }

        const duration = player.queue.current.length;
        if (seconds * 1000 > duration) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x8e7cc3).setDescription(`\`❌\` | **Time exceeds track duration!**`)],
                ephemeral: true
            });
        }

        player.seek(seconds * 1000);

        const formatTime = (sec) => {
            const min = Math.floor(sec / 60);
            const s = sec % 60;
            return `${min}:${s.toString().padStart(2, '0')}`;
        };

        const embed = new EmbedBuilder()
            .setColor(0x8e7cc3)
            .setTitle('Seeked')
            .setDescription(`⏩ Jumped to **${formatTime(seconds)}**`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};


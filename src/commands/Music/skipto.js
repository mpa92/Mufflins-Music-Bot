const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
        .setName('skipto')
        .setDescription('⏭️ Skip to a specific song in the queue')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('The position of the song in the queue')
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction, client) {
        const value = interaction.options.getInteger('position');

        const player = client.manager.players.get(interaction.guild.id);
        if (!player) return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setDescription('`🚫` **No music is currently playing in this guild!**')
            ],
            ephemeral: true
        });

        const { channel } = interaction.member.voice;
        if (!channel || interaction.member.voice.channel !== interaction.guild.members.me.voice.channel) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`🔇` **I\'m not in the same voice channel as you!**')
                ],
                ephemeral: true
            });
        }

        if (value > player.queue.length || (value && !player.queue[value - 1])) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription('`⚠️` **You can\'t skip to a song that doesn\'t exist!**')
                        .setFooter({ text: `The queue has ${player.queue.length} tracks` })
                ],
                ephemeral: true
            });
        }

        await player.queue.splice(0, value - 1);
        await player.skip();

        const embed = new EmbedBuilder()
            .setDescription(`⏭️ | *Skipped to song in position:* \`${value}\``)
            .setColor(0x8e7cc3)
            .setFooter({ text: 'Mufflins Music Bot' });

        return interaction.reply({ embeds: [embed] });
    }
};


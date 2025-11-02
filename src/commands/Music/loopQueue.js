const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
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
        .setName('loopqueue')
        .setDescription('🔁 Loop all songs in the queue'),

    async execute(interaction, client) {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription("`❌` **No song is currently playing in this guild!**")
                ],
                ephemeral: true
            });
        }

        const { channel } = interaction.member.voice;
        if (!channel || interaction.member.voice.channel !== interaction.guild.members.me.voice.channel) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x8e7cc3)
                        .setDescription("`🔒` **I'm not in the same voice channel as you!**")
                ],
                ephemeral: true
            });
        }

        if (player.loop === 'queue') {
            player.setLoop('none');

            const embed = new EmbedBuilder()
                .setTitle('🔁 Loop Status')
                .setDescription("**Looping all songs in the queue has been:** `Disabled`")
                .setColor(0x8e7cc3)
                .setFooter({ text: 'Feel free to add more songs! • Mufflins Music Bot', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        } else {
            player.setLoop('queue');

            const embed = new EmbedBuilder()
                .setTitle('🔁 Loop Status')
                .setDescription("**Looping all songs in the queue has been:** `Enabled`")
                .setColor(0x8e7cc3)
                .setFooter({ text: 'Enjoy your endless music! • Mufflins Music Bot', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    }
};


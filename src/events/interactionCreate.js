module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Slash commands are disabled - only handle button interactions for music controls
        // Button interactions are handled in src/index.js, so we let those pass through
        
        // Reject all slash commands and autocomplete
        if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
            return interaction.reply({
                embeds: [{
                    color: 0x8e7cc3,
                    description: '`❌` | **Slash commands are disabled!**\n\nPlease use prefix commands with `mm!` instead.\nExample: `mm!play <song>`',
                    footer: { text: 'Use mm!help to see all available commands' }
                }],
                ephemeral: true
            }).catch(() => {});
        }
        
        // Let button interactions pass through to be handled in index.js
    },
};


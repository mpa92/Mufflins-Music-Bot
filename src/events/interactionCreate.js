module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Handle autocomplete interactions
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            
            if (!command || typeof command.autocomplete !== 'function') {
                console.error(`No autocomplete handler found for command: ${interaction.commandName}`);
                return;
            }

            try {
                await command.autocomplete(interaction, client);
            } catch (error) {
                console.error('Autocomplete Error:', error);
                await interaction.respond([]).catch(() => {});
            }
            return;
        }

        // Handle command interactions
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error('Command Execution Error:', error);
            
            const errorEmbed = {
                color: 0x8e7cc3, // Mufflins purple color
                description: '`❌` | **An error occurred while executing this command!**',
                footer: {
                    text: 'Please try again later or contact the bot owner if the issue persists'
                }
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
};


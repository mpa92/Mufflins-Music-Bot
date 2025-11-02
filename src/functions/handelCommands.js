const { REST } = require("@discordjs/rest");
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');

module.exports = (client) => {
    client.handleCommands = async (commandFolders, path) => {
        // Slash commands disabled - using prefix commands only (mm!)
        console.log('⚠️  Slash commands are disabled. Using prefix commands (mm!) only.');
        
        const rest = new REST({
            version: '9'
        }).setToken(process.env.TOKEN);

        const clientId = client.user.id;

        // Delete all existing slash commands
        (async () => {
            try {
                console.log('🗑️  Removing all slash commands from Discord...');
                
                await rest.put(
                    Routes.applicationCommands(clientId), {
                        body: [] // Empty array = delete all commands
                    },
                );

                console.log('✅ All slash commands have been removed.');
            } catch (error) {
                console.error('Error removing slash commands:', error);
            }
        })();
    };
};


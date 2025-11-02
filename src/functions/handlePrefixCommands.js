const fs = require('fs');

module.exports = (client) => {
    client.handlePrefixCommands = async (commandFolders, path) => {
        client.prefixCommands = new Map();
        
        for (const folder of commandFolders) {
            const commandFiles = fs.readdirSync(`${path}/${folder}`).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const command = require(`../${path.split('/').pop()}/${folder}/${file}`);
                
                if (command.name) {
                    client.prefixCommands.set(command.name, command);
                    console.log(`✅ Prefix command loaded: ${command.name}`);
                    
                    // Also register aliases if they exist
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach(alias => {
                            client.prefixCommands.set(alias, command);
                        });
                    }
                }
            }
        }
    };
};


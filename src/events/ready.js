const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ Logged in as ${client.user.tag}`);
        
        // Set custom presence with Mufflins branding
        client.user.setPresence({
            activities: [{
                type: ActivityType.Custom,
                name: "custom",
                state: "🎵 Playing music | /help"
            }]
        });

        console.log(`📊 Serving ${client.guilds.cache.size} servers`);
        console.log(`🎵 Mufflins Music Bot is ready!`);
    },
};


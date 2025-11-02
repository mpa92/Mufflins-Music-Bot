const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const { Connectors } = require("shoukaku");
const { Kazagumo, Plugins } = require("kazagumo");
const KazagumoFilter = require('kazagumo-filter');
const config = require('../config.json');
const { setBotClient } = require('../server.js');
require('dotenv').config();

// Prefix for commands
const PREFIX = 'mm!';

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Lavalink nodes configuration (supports both env vars and config.json)
const Nodes = [{
    name: process.env.LAVALINK_NAME || 'Mufflins-Lavalink',
    url: process.env.LAVALINK_HOST ? 
        `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT || 443}` : 
        `${config.lavalink.host}:${config.lavalink.port}`,
    auth: process.env.LAVALINK_PASSWORD || config.lavalink.password,
    secure: process.env.LAVALINK_SECURE === 'true' || false
}];

console.log(`🔗 Connecting to Lavalink: ${Nodes[0].url} (secure: ${Nodes[0].secure})`);

// Initialize Kazagumo music manager
client.manager = new Kazagumo({
    defaultSearchEngine: 'youtube',
    plugins: [new Plugins.PlayerMoved(client), new KazagumoFilter()],
    send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    }
}, new Connectors.DiscordJS(client), Nodes);

// Manager ready event
client.manager.shoukaku.on('ready', (name) => {
    console.log(`✅ Lavalink node "${name}" connected and ready`);
    client.managerReady = true;
});

client.manager.shoukaku.on('error', (name, error) => {
    console.error(`❌ Lavalink node "${name}" error:`, error.message);
});

client.manager.shoukaku.on('close', (name, code, reason) => {
    console.warn(`⚠️ Lavalink node "${name}" closed. Code: ${code}, Reason: ${reason}`);
});

client.manager.shoukaku.on('disconnect', (name, count) => {
    console.warn(`⚠️ Lavalink node "${name}" disconnected. Count: ${count}`);
});

// Initialize prefix commands collection
client.prefixCommands = new Map();

// Load function handlers
const functions = fs.readdirSync("./src/functions").filter(file => file.endsWith(".js"));
const eventFiles = fs.readdirSync("./src/events").filter(file => file.endsWith(".js"));
const prefixCommandFolders = fs.readdirSync("./src/prefix");

// Load all handlers
(async () => {
    for (const file of functions) {
        require(`./functions/${file}`)(client);
    }
    client.handleEvents(eventFiles, "./src/events");
    
    // Wait for client to be ready before handling commands
    client.once('ready', () => {
        console.log(`✅ Bot is online as ${client.user.tag}`);
        console.log(`🎵 Serving ${client.guilds.cache.size} guilds`);
        console.log(`🎮 Prefix: mm!`);
        client.handlePrefixCommands(prefixCommandFolders, "./src/prefix");
        
        // Set bot client in server.js for API access
        setBotClient(client);
    });
    
    await client.login(process.env.TOKEN);
})();

// Prefix command handler
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.prefixCommands?.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args, client);
    } catch (error) {
        console.error('Prefix Command Error:', error);
        message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setDescription('`❌` | **An error occurred while executing this command!**')
                    .setFooter({ text: 'Please try again later' })
            ]
        }).catch(() => {});
    }
});

// Kazagumo player events
client.manager.on('playerStart', (player, track) => {
    const playerStartEvent = require('./events/playerStart');
    playerStartEvent(client, player, track);
});

client.manager.on('playerEmpty', (player) => {
    const playerEmptyEvent = require('./events/playerEmpty');
    playerEmptyEvent(client, player);
});

client.manager.on('playerEnd', (player) => {
    const playerEndEvent = require('./events/playerEnd');
    playerEndEvent(client, player);
});

// Handle button interactions for player controls (from mm!nowplaying buttons)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const player = client.manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'No music is currently playing!', ephemeral: true });

    // Check if user is in same voice channel
    const { channel } = interaction.member.voice;
    if (!channel || channel.id !== player.voiceId) {
        return interaction.reply({ content: 'You must be in the same voice channel as me!', ephemeral: true });
    }

    try {
        switch (interaction.customId) {
            case 'skip':
                if (player.queue.size === 0) {
                    return interaction.reply({ content: 'No more tracks in the queue to skip!', ephemeral: true });
                }
                player.skip();
                await interaction.reply({ content: '⏭️ Skipped the current track!', ephemeral: true });
                break;

            case 'shuffle':
                if (player.queue.size === 0) {
                    return interaction.reply({ content: 'Queue is empty!', ephemeral: true });
                }
                player.queue.shuffle();
                await interaction.reply({ content: '🔀 Shuffled the queue!', ephemeral: true });
                break;

            case 'loop':
                if (player.loop === 'track') {
                    player.setLoop('none');
                    await interaction.reply({ content: '🔁 Looping is now disabled.', ephemeral: true });
                } else {
                    player.setLoop('track');
                    await interaction.reply({ content: '🔁 Looping the current track.', ephemeral: true });
                }
                break;

            case 'previous':
                const previous = player.getPrevious();
                if (!previous) {
                    return interaction.reply({ content: 'No previous track found!', ephemeral: true });
                }
                await player.play(player.getPrevious(true));
                await interaction.reply({ content: '⏮️ Playing previous track!', ephemeral: true });
                break;

            case 'pause':
                if (player.paused) {
                    return interaction.reply({ content: 'The player is already paused!', ephemeral: true });
                }
                player.pause(true);
                await interaction.reply({ content: '⏸️ Paused the music!', ephemeral: true });
                break;

            case 'resume':
                if (!player.paused) {
                    return interaction.reply({ content: 'The player is already playing!', ephemeral: true });
                }
                player.pause(false);
                await interaction.reply({ content: '▶️ Resumed the music!', ephemeral: true });
                break;

            case 'queue':
                const queue = player.queue;
                const queueEmbed = new EmbedBuilder()
                    .setTitle('Current Queue')
                    .setDescription(Array.from(queue).slice(0, 10).map((track, index) => 
                        `${index + 1}. **[${track.title}](${track.uri})**`
                    ).join('\n') || 'No tracks in queue.')
                    .setColor(0x8e7cc3)
                    .setFooter({ text: `Total: ${queue.size} tracks` });
                await interaction.reply({ embeds: [queueEmbed], ephemeral: true });
                break;

            default:
                await interaction.reply({ content: 'Unknown action!', ephemeral: true });
                break;
        }
    } catch (error) {
        console.error('Button interaction error:', error);
        await interaction.reply({ content: 'An error occurred!', ephemeral: true }).catch(() => {});
    }
});

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

console.log('🎵 Mufflins Music Bot is starting...');

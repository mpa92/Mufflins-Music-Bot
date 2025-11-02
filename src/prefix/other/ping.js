const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ping',
    aliases: ['latency'],
    description: 'Check the bot latency',
    usage: 'mm!ping',
    
    async execute(message, args, client) {
        const sent = await message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setDescription('`🏓` | Pinging...')
            ]
        });

        const latency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);

        return sent.edit({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8e7cc3)
                    .setTitle('🏓 Pong!')
                    .addFields([
                        { name: '`⏱️` Bot Latency', value: `${latency}ms`, inline: true },
                        { name: '`🌐` API Latency', value: `${apiLatency}ms`, inline: true }
                    ])
                    .setFooter({ text: 'Mufflins Music Bot' })
                    .setTimestamp()
            ]
        });
    }
};


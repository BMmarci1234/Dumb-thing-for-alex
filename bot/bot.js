const { Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

// Setup command handler
client.commands = new Collection();
const loadCommandsFrom = require('./utils/loadCommands');
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = loadCommandsFrom(commandsPath);
for (const file of commandFiles) {
    const command = require(file);
    if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${file} is missing "data" or "execute".`);
    }
}

// ... rest of bot.js stays the same ...

// Handle command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (!interaction.replied)
            await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
    }
});

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Export bot and utilities (for server.js)
const { getUserRoles } = require('./utils/roleCheck');
client.login(process.env.DISCORD_BOT_TOKEN);
module.exports = { client, getUserRoles };
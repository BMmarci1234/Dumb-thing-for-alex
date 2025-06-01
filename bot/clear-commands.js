require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

// Uncomment ONE of these at a time to clear

// Clear global commands
rest.put(Routes.applicationCommands(clientId), { body: [] }).then(() => {
  console.log('Cleared GLOBAL commands!');
});

// Clear guild commands
// rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] }).then(() => {
//   console.log('Cleared GUILD commands!');
// });
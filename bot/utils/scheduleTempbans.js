// Call this ONCE after your client is ready
// Example: client.once('ready', () => scheduleAllTempbans(client));

const tempbanStore = require('./tempbanStore');

function scheduleAllTempbans(client) {
  const tempbans = tempbanStore.getAll();
  for (const ban of tempbans) {
    const ms = ban.unbanAt - Date.now();
    if (ms > 0) {
      setTimeout(() => doUnban(client, ban.guildId, ban.userId, ban.reason), ms);
    } else {
      doUnban(client, ban.guildId, ban.userId, ban.reason);
    }
  }
}

async function doUnban(client, guildId, userId, reason) {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;
  await guild.members.unban(userId, 'Temporary ban expired')
    .catch(() => {}); // User may already be unbanned
  tempbanStore.removeTempban(guildId, userId);
}

module.exports = scheduleAllTempbans;
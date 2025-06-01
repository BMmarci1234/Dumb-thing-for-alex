// bot/utils/roleCheck.js

require('dotenv').config();

/**
 * Get a user's roles in the target guild
 * @param {Client} client - Discord bot client
 * @param {string} userId - User ID to check
 * @returns {Promise<string[]>} Array of role IDs
 */
async function getUserRoles(client, userId) {
    try {
        const guildId = process.env.DISCORD_GUILD_ID;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) throw new Error("Bot is not in the specified guild");

        const member = await guild.members.fetch(userId);
        return member ? Array.from(member.roles.cache.keys()) : [];
    } catch (err) {
        console.error("Error fetching user roles:", err.message);
        return [];
    }
}

module.exports = { getUserRoles };
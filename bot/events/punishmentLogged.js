const { EmbedBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  name: 'punishmentLogged',
  async execute(user, totalPoints, client) {
    if (totalPoints < 16) return;

    // Fetch user's infractions for embed
    const infractions = db.getInfractions(user.id);

    // Format infractions list
    const infractionList = infractions.map(i =>
        `**${i.type}**: ${i.reason}${i.circle ? ' _(Circle)_ ' : ''} <t:${Math.floor(i.timestamp/1000)}:R>`
    ).join('\n');

    // Embed
    const embed = new EmbedBuilder()
        .setTitle(`User ${user.tag} reached 16+ Circle Points!`)
        .setDescription(`${user} now has **${totalPoints} Circle Points**.`)
        .addFields({
            name: "Infractions",
            value: infractionList.slice(0, 1024) || 'None'
        })
        .setColor(0xff0000)
        .setTimestamp();

    // Ping the staff role
    const staffRole = process.env.DISCORD_STAFF || "1295370286719303752";
    // Send to the first mod log channel found, or fallback to system channel
    const guild = client.guilds.cache.first();
    let logChannel = guild?.channels.cache.find(c =>
        c.type === 0 &&
        (c.name.includes('mod') || c.name.includes('log')) &&
        c.viewable
    );
    if (!logChannel) logChannel = guild?.systemChannel;

    if (logChannel) {
        await logChannel.send({ content: `<@&${staffRole}>`, embeds: [embed] });
    }
  }
};
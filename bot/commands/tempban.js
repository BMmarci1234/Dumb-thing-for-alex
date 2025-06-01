const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');
const points = require('../utils/points');
const parseDuration = require('../utils/parseDuration');
const tempbanStore = require('../utils/tempbanStore');

const BAN_PERMISSION_ROLE = process.env.BAN_PERMISSION_ROLE;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Temporarily ban a user (auto-unbans after duration).')
    .addUserOption(opt => opt.setName('user').setDescription('User to tempban').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 1d, 1w)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.roles.cache.has(BAN_PERMISSION_ROLE)) {
      return interaction.reply({ content: "You don't have permission to use this command (ban-permission-role required).", ephemeral: true });
    }
    const target = interaction.options.getMember('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason');
    if (!target) return interaction.reply({ content: "User not found in this server.", ephemeral: true });

    const ms = parseDuration(durationStr);
    if (!ms || ms < 1000 || ms > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({ content: "Duration must be between 1 second and 28 days.", ephemeral: true });
    }

    // DM the user before ban
    const embed = new EmbedBuilder()
      .setTitle('You have been temporarily banned')
      .setDescription(`Reason: **${reason}**\nDuration: **${durationStr}**\nModerator: <@${interaction.user.id}>`)
      .setColor(0x8B0000)
      .setTimestamp();

    try { await target.send({ embeds: [embed] }); } catch (e) {}

    try { await target.ban({ reason }); }
    catch (e) { return interaction.reply({ content: "Failed to ban: " + e.message, ephemeral: true }); }

    db.addInfraction(target.id, {
      type: 'tempban',
      moderator: interaction.user.id,
      reason,
      duration: durationStr,
      circle: true,
      timestamp: Date.now()
    });

    const total = await points.addPoints(target.id, 'tempban');
    if (total >= 16) interaction.client.emit('punishmentLogged', target.user, total);

    // Save and schedule the unban
    const unbanAt = Date.now() + ms;
    tempbanStore.addTempban(interaction.guild.id, target.id, unbanAt, reason);

    await interaction.reply({ content: `<@${target.id}> has been tempbanned for ${durationStr}. Reason: ${reason} (+8 points)`, ephemeral: true });

    scheduleUnban(interaction.client, interaction.guild.id, target.id, unbanAt, reason);
  },
};

// This function will schedule unban for a single user
function scheduleUnban(client, guildId, userId, unbanAt, reason) {
  const ms = unbanAt - Date.now();
  if (ms <= 0) {
    doUnban(client, guildId, userId, reason);
    return;
  }
  setTimeout(() => doUnban(client, guildId, userId, reason), ms);
}

async function doUnban(client, guildId, userId, reason) {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;
  await guild.members.unban(userId, 'Temporary ban expired')
    .catch(() => {}); // User may already be unbanned
  tempbanStore.removeTempban(guildId, userId);
}
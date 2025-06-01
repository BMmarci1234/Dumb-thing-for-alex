const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');
const points = require('../utils/points');
const parseDuration = require('../utils/parseDuration');

const STAFF_ROLE = process.env.DISCORD_STAFF;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user for a duration (always adds 4 points).')
    .addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d, 1w)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
      return interaction.reply({ content: "You don't have permission to use this command (staff role required).", ephemeral: true });
    }
    const target = interaction.options.getMember('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason');
    if (!target) return interaction.reply({ content: "User not found in this server.", ephemeral: true });

    const ms = parseDuration(durationStr);
    if (!ms || ms < 60000 || ms > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({ content: "Duration must be between 1 minute and 28 days (e.g. 10m, 1h, 1d, 1w).", ephemeral: true });
    }

    try { await target.timeout(ms, reason); }
    catch (e) { return interaction.reply({ content: "Failed to mute: " + e.message, ephemeral: true }); }

    db.addInfraction(target.id, {
      type: 'mute',
      moderator: interaction.user.id,
      reason,
      duration: durationStr,
      circle: true,
      timestamp: Date.now()
    });

    const total = await points.addPoints(target.id, 'mute');
    if (total >= 16) interaction.client.emit('punishmentLogged', target.user, total);

    // DM the user
    const embed = new EmbedBuilder()
      .setTitle('You have been muted')
      .setDescription(`Reason: **${reason}**\nDuration: **${durationStr}**\nModerator: <@${interaction.user.id}>`)
      .setColor(0xFF5555)
      .setTimestamp();

    try { await target.send({ embeds: [embed] }); } catch (e) {}

    await interaction.reply({ content: `<@${target.id}> has been muted for ${durationStr}. Reason: ${reason} (+4 points)`, ephemeral: true });
  },
};
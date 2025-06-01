const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');
const points = require('../utils/points');

const STAFF_ROLE = process.env.DISCORD_STAFF;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user (always adds 6 points).')
    .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
      return interaction.reply({ content: "You don't have permission to use this command (staff role required).", ephemeral: true });
    }
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');
    if (!target) return interaction.reply({ content: "User not found in this server.", ephemeral: true });

    // DM the user before kick
    const embed = new EmbedBuilder()
      .setTitle('You have been kicked')
      .setDescription(`Reason: **${reason}**\nModerator: <@${interaction.user.id}>`)
      .setColor(0xFF0000)
      .setTimestamp();

    try { await target.send({ embeds: [embed] }); } catch (e) {}

    try { await target.kick(reason); }
    catch (e) { return interaction.reply({ content: "Failed to kick: " + e.message, ephemeral: true }); }

    db.addInfraction(target.id, {
      type: 'kick',
      moderator: interaction.user.id,
      reason,
      circle: true,
      timestamp: Date.now()
    });

    const total = await points.addPoints(target.id, 'kick');
    if (total >= 16) interaction.client.emit('punishmentLogged', target.user, total);

    await interaction.reply({ content: `<@${target.id}> has been kicked. Reason: ${reason} (+6 points)`, ephemeral: true });
  },
};
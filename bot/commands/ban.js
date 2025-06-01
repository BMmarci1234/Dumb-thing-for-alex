const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');

const BAN_PERMISSION_ROLE = process.env.BAN_PERMISSION_ROLE;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user (does NOT add points).')
    .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.roles.cache.has(BAN_PERMISSION_ROLE)) {
      return interaction.reply({ content: "You don't have permission to use this command (ban-permission-role required).", ephemeral: true });
    }
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');
    if (!target) return interaction.reply({ content: "User not found in this server.", ephemeral: true });

    // DM the user before ban
    const embed = new EmbedBuilder()
      .setTitle('You have been banned')
      .setDescription(`Reason: **${reason}**\nModerator: <@${interaction.user.id}>`)
      .setColor(0x000000)
      .setTimestamp();

    try { await target.send({ embeds: [embed] }); } catch (e) {}

    try { await target.ban({ reason }); }
    catch (e) { return interaction.reply({ content: "Failed to ban: " + e.message, ephemeral: true }); }

    db.addInfraction(target.id, {
      type: 'ban',
      moderator: interaction.user.id,
      reason,
      circle: false,
      timestamp: Date.now()
    });

    await interaction.reply({ content: `<@${target.id}> has been banned. Reason: ${reason}`, ephemeral: true });
  },
};
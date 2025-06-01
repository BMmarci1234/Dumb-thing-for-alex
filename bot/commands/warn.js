const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');
const points = require('../utils/points');
const STAFF_ROLE = process.env.DISCORD_STAFF;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user (always adds 3 points).')
    .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
      return interaction.reply({ content: "You don't have permission to use this command (staff role required).", ephemeral: true });
    }
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    db.addInfraction(target.id, {
      type: 'warning',
      moderator: interaction.user.id,
      reason,
      circle: true,
      timestamp: Date.now()
    });

    const total = await points.addPoints(target.id, 'warning');
    if (total >= 16) interaction.client.emit('punishmentLogged', target, total);

    // DM the user
    const embed = new EmbedBuilder()
      .setTitle('You have been warned')
      .setDescription(`Reason: **${reason}**\nModerator: <@${interaction.user.id}>`)
      .setColor(0xFFA500)
      .setTimestamp();

    try { await target.send({ embeds: [embed] }); } catch (e) {}

    await interaction.reply({ content: `<@${target.id}> has been warned. Reason: ${reason} (+3 points)`, ephemeral: true });
  },
};
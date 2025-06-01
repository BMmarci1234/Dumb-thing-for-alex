const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const STAFF_ROLE = process.env.DISCORD_STAFF;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a user (remove timeout).')
    .addUserOption(opt => opt.setName('user').setDescription('User to unmute').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for unmuting').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
      return interaction.reply({ content: "You don't have permission to use this command (staff role required).", ephemeral: true });
    }
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');
    if (!target) return interaction.reply({ content: "User not found in this server.", ephemeral: true });

    if (!target.communicationDisabledUntil) {
      return interaction.reply({ content: `<@${target.id}> is not currently muted.`, ephemeral: true });
    }

    try { await target.timeout(null, reason); }
    catch (e) { return interaction.reply({ content: "Failed to unmute: " + e.message, ephemeral: true }); }

    // DM the user
    const embed = new EmbedBuilder()
      .setTitle('You have been unmuted')
      .setDescription(`Reason: **${reason}**\nModerator: <@${interaction.user.id}>`)
      .setColor(0x4CAF50)
      .setTimestamp();

    try { await target.send({ embeds: [embed] }); } catch (e) {}

    await interaction.reply({ content: `<@${target.id}> has been unmuted. Reason: ${reason}`, ephemeral: true });
  },
};
const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

const BAN_PERMISSION_ROLE = process.env.BAN_PERMISSION_ROLE;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server.')
    .addUserOption(opt => opt.setName('user').setDescription('User to unban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for unbanning').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.roles.cache.has(BAN_PERMISSION_ROLE)) {
      return interaction.reply({ content: "You don't have permission to use this command (ban-permission-role required).", ephemeral: true });
    }
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const guild = interaction.guild;

    try { await guild.bans.fetch(user.id); }
    catch { return interaction.reply({ content: `<@${user.id}> is not banned from this server.`, ephemeral: true }); }

    try { await guild.members.unban(user.id, reason); }
    catch (e) { return interaction.reply({ content: "Failed to unban: " + e.message, ephemeral: true }); }

    // DM the user
    const embed = new EmbedBuilder()
      .setTitle('You have been unbanned')
      .setDescription(`Reason: **${reason}**\nModerator: <@${interaction.user.id}>`)
      .setColor(0x4CAF50)
      .setTimestamp();

    try { await user.send({ embeds: [embed] }); } catch (e) {}

    await interaction.reply({ content: `<@${user.id}> has been unbanned. Reason: ${reason}`, ephemeral: true });
  },
};
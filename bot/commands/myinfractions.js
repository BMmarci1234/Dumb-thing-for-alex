const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../utils/db');
const points = require('../utils/points');
const STAFF_ROLE = process.env.DISCORD_STAFF;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('myinfractions')
    .setDescription('View your infractions, or use {user} for staff to view/remove.')
    .addUserOption(opt => opt.setName('user').setDescription('User to view (staff only)').setRequired(false))
    .addStringOption(opt => opt.setName('action').setDescription('Action: remove (staff only)').setRequired(false))
    .addStringOption(opt => opt.setName('infractionid').setDescription('Infraction ID to remove (staff only)').setRequired(false)),
  async execute(interaction) {
    const staff = interaction.member.roles.cache.has(STAFF_ROLE) || interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

    const target = interaction.options.getUser('user') || interaction.user;
    const action = interaction.options.getString('action');
    const infractionId = interaction.options.getString('infractionid');
    const ownerId = process.env.OWNER_ID;

    // Remove infraction (staff only)
    if (action === 'remove') {
      if (!staff) {
        return interaction.reply({ content: "You don't have permission to remove infractions.", ephemeral: true });
      }
      if (!infractionId) {
        return interaction.reply({ content: "Please provide an infraction ID to remove.", ephemeral: true });
      }
      const deleted = db.deleteInfraction(infractionId);
      if (deleted) {
        // Subtract points if infraction type is pointable
        const removedType = deleted.type;
        const removedUserId = deleted.userId;
        const removedUser = await interaction.client.users.fetch(removedUserId).catch(() => null);
        await points.removePoints(removedUserId, removedType);

        // DM the user
        if (removedUser) {
          try {
            await removedUser.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle('Your infraction was removed')
                  .setDescription(`An infraction (**${removedType}**) has been removed from your record by <@${interaction.user.id}>.`)
                  .setColor(0x4CAF50)
                  .setTimestamp()
              ]
            });
          } catch (e) {/* DMs closed */}
        }

        // DM the OWNER
        if (ownerId) {
          try {
            const owner = await interaction.client.users.fetch(ownerId).catch(() => null);
            if (owner) {
              await owner.send({
                content: `Infraction \`${infractionId}\` (**${removedType}**) was removed from <@${removedUserId}> by <@${interaction.user.id}>.`
              });
            }
          } catch (e) {/* DMs closed */}
        }

        return interaction.reply({ content: `Infraction ${infractionId} removed and points adjusted.`, ephemeral: true });
      } else {
        return interaction.reply({ content: `Infraction ID not found.`, ephemeral: true });
      }
    }

    // If user is not staff and requested someone else, deny
    if (target.id !== interaction.user.id && !staff) {
      return interaction.reply({ content: "You can only view your own infractions.", ephemeral: true });
    }

    const infractions = db.getInfractions(target.id);
    const totalPoints = points.getPoints(target.id);

    if (!infractions.length) {
      return interaction.reply({ content: `<@${target.id}> has no infractions.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Infractions for ${target.tag}`)
      .setDescription(
        infractions.map(i =>
          `**ID:** \`${i.id}\` | **${i.type}**: ${i.reason}${i.circle ? ' _(Circle)_ ' : ''}${i.duration ? ` | **Duration**: ${i.duration}` : ''} <t:${Math.floor(i.timestamp/1000)}:R>`
        ).join('\n')
      )
      .addFields({ name: 'Total Circle Points', value: totalPoints.toString(), inline: false })
      .setColor('#FFCC00');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
const { MessageFlags } = require('discord.js');
const config = require('config');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

/**
 * Vérifie si un membre a la permission d'utiliser une commande
 * @param {Object} interaction L'interaction Discord
 * @returns {boolean} True si l'utilisateur a la permission
 */
async function checkPermission(interaction) {
  // Obtenir les IDs de rôles de l'utilisateur
  const memberRoleIds = interaction.member.roles.cache.map(role => role.id);
  
  // Vérifier si l'utilisateur a un rôle autorisé
  const allowedRoleIds = config.get('allowed_role_ids') || [];
  const allowedRoleNames = config.get('allowed_roles') || [];
  
  // Vérifier d'abord par ID (plus sûr)
  let hasPermission = memberRoleIds.some(id => allowedRoleIds.includes(id));
  
  // Si pas de correspondance par ID, essayer par nom (compatibilité)
  if (!hasPermission) {
    const memberRoleNames = interaction.member.roles.cache.map(role => role.name);
    hasPermission = memberRoleNames.some(name => allowedRoleNames.includes(name));
  }
  
  // Si l'utilisateur n'a pas la permission, répondre avec un message d'erreur
  if (!hasPermission) {
    logger.warn(`User ${interaction.user.tag} attempted to use command without permission`);
    
    await interaction.reply({
      embeds: [embeds.noPermissionEmbed],
      flags: MessageFlags.Ephemeral,
    });
  }
  
  return hasPermission;
}

/**
 * Vérifie si l'utilisateur est dans un canal vocal
 * @param {Object} interaction L'interaction Discord
 * @returns {boolean} True si l'utilisateur est dans un canal vocal
 */
async function checkVoiceChannel(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  
  if (!voiceChannel) {
    await interaction.reply({
      embeds: [embeds.noVoiceChannelEmbed],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  
  return true;
}

/**
 * Vérifie si la commande est exécutée dans un thread
 * @param {Object} interaction L'interaction Discord
 * @returns {boolean} True si la commande peut continuer (pas dans un thread)
 */
async function checkNotInThread(interaction) {
  if (interaction.channel.isThread()) {
    await interaction.reply({
      embeds: [embeds.threadEmbed],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  
  return true;
}

module.exports = {
  checkPermission,
  checkVoiceChannel,
  checkNotInThread
};
const logger = require('../utils/logger');

/**
 * Envoie un message en le découpant si nécessaire
 * @param {Object} channel Canal Discord où envoyer le message
 * @param {string} content Contenu du message
 * @param {number} chunkSize Taille maximale des chunks (défaut: 2000)
 */
async function sendLongMessage(channel, content, chunkSize = 2000) {
  if (!content || content.length === 0) {
    logger.warn('Tentative d\'envoi d\'un message vide');
    return;
  }

  try {
    const lines = content.split('\n');
    let messageChunk = '';

    for (const line of lines) {
      // Si ajouter cette ligne dépasse la limite, envoyer le chunk actuel
      if ((messageChunk + '\n' + line).length > chunkSize) {
        await channel.send(messageChunk);
        messageChunk = line;
      } else {
        messageChunk += (messageChunk ? '\n' : '') + line;
      }
    }

    // Envoyer le dernier chunk s'il reste du contenu
    if (messageChunk) {
      await channel.send(messageChunk);
    }
  } catch (error) {
    logger.error('Error sending long message', error);
    throw error;
  }
}

/**
 * Envoie un summary au format markdown dans un thread
 * @param {string} summary Contenu du résumé
 * @param {Object} thread Thread Discord où envoyer le résumé
 */
async function sendSummary(summary, thread) {
  try {
    await sendLongMessage(thread, summary);
    logger.info('Summary sent successfully');
  } catch (error) {
    logger.error('Error sending summary', error);
    await thread.send('Error sending the complete summary. Please check the logs.');
  }
}

/**
 * Crée un thread et envoie un message formaté
 * @param {Object} interaction Interaction Discord
 * @param {string} threadName Nom du thread
 * @param {string} content Contenu à envoyer
 * @param {Object} options Options supplémentaires
 * @returns {Object} Le thread créé
 */
async function createThreadWithContent(interaction, threadName, content, options = {}) {
  try {
    // Créer ou utiliser un message pour le thread
    let message;
    if (options.useReply) {
      await interaction.reply(options.replyContent || '📝 Processing...');
      message = await interaction.fetchReply();
    } else {
      message = await interaction.channel.send(options.replyContent || '📝 Processing...');
    }
    
    // Créer le thread
    const thread = await message.startThread({ name: threadName });
    
    // Envoyer le contenu
    if (content) {
      await sendLongMessage(thread, content);
    }
    
    return thread;
  } catch (error) {
    logger.error('Error creating thread with content', error);
    throw error;
  }
}

module.exports = {
  sendLongMessage,
  sendSummary,
  createThreadWithContent
};
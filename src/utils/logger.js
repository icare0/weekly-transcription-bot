const fs = require('fs');
const path = require('path');

// Créer le dossier logs s'il n'existe pas
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Niveaux de log
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Logger simple pour le bot
 */
class Logger {
  constructor() {
    this.logFile = path.join(logsDir, `bot-${new Date().toISOString().split('T')[0]}.log`);
  }

  /**
   * Format un message de log
   * @param {string} level Niveau de log
   * @param {string} message Message à logger
   * @param {Object} [data] Données additionnelles
   * @returns {string} Message formaté
   */
  formatLogMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      try {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        logMessage += ` - ${dataStr}`;
      } catch (err) {
        logMessage += ` - [Non-serializable data]`;
      }
    }
    
    return logMessage;
  }

  /**
   * Écrit un message dans les logs
   * @param {string} level Niveau de log
   * @param {string} message Message à logger
   * @param {Object} [data] Données additionnelles
   */
  log(level, message, data) {
    const formattedMessage = this.formatLogMessage(level, message, data);
    
    // Affichage dans la console
    console.log(formattedMessage);
    
    // Écriture dans le fichier
    fs.appendFileSync(this.logFile, formattedMessage + '\n');
  }

  error(message, data) {
    this.log(LOG_LEVELS.ERROR, message, data);
  }

  warn(message, data) {
    this.log(LOG_LEVELS.WARN, message, data);
  }

  info(message, data) {
    this.log(LOG_LEVELS.INFO, message, data);
  }

  debug(message, data) {
    this.log(LOG_LEVELS.DEBUG, message, data);
  }
}

module.exports = new Logger();
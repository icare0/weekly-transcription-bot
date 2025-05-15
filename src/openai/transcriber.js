const fs = require('fs');
const OpenAI = require('openai');
const config = require('config');
const logger = require('../utils/logger');

/**
 * Classe pour gérer la transcription via OpenAI
 */
class Transcriber {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = config.get('openai.transcription_model');
    this.language = config.get('openai.transcription_language');
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 secondes
  }

  /**
   * Transcrit un fichier audio via l'API OpenAI
   * @param {string} filePath Chemin du fichier audio
   * @param {number} retryCount Compteur de tentatives
   * @returns {Promise<string>} Texte transcrit
   */
  async transcribeFile(filePath, retryCount = 0) {
    if (!fs.existsSync(filePath)) {
      logger.error(`File does not exist: ${filePath}`);
      throw new Error(`File does not exist: ${filePath}`);
    }

    try {
      logger.info(`Transcribing file: ${filePath} (attempt ${retryCount + 1}/${this.maxRetries + 1})`);
      
      const openai = new OpenAI({
        apiKey: this.apiKey
      });

      const fileStream = fs.createReadStream(filePath);
      
      const transcription = await openai.audio.transcriptions.create({
        file: fileStream,
        model: this.model,
        language: this.language,
      });

      logger.info(`Transcription successful for file: ${filePath}`);
      return transcription.text;
    } catch (error) {
      logger.error(`Error transcribing file: ${filePath}`, error);
      
      // Gérer les erreurs de l'API
      if (error.status === 429 || error.status >= 500) {
        if (retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount);
          logger.warn(`Rate limited or server error, retrying in ${delay}ms`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.transcribeFile(filePath, retryCount + 1);
        }
      }
      
      throw new Error(`Transcription failed after ${retryCount + 1} attempts: ${error.message}`);
    }
  }

  /**
   * Transcrit plusieurs fichiers audio et combine les résultats
   * @param {string[]} audioParts Chemins des fichiers audio
   * @returns {Promise<string>} Texte transcrit complet
   */
  async transcribe(audioParts) {
    if (!audioParts || audioParts.length === 0) {
      logger.error('No audio parts provided for transcription');
      throw new Error('No audio parts provided for transcription');
    }

    logger.info(`Starting transcription of ${audioParts.length} audio parts`);
    let fullTranscription = '';

    try {
      for (let i = 0; i < audioParts.length; i++) {
        const filePath = audioParts[i];
        logger.info(`Transcribing part ${i + 1}/${audioParts.length}: ${filePath}`);
        
        const transcription = await this.transcribeFile(filePath);
        fullTranscription += transcription + ' ';
        
        // Nettoyer les fichiers temporaires (parties) mais pas le fichier original
        if (audioParts.length > 1 && filePath.includes('_part')) {
          try {
            fs.unlinkSync(filePath);
            logger.debug(`Removed temporary file: ${filePath}`);
          } catch (e) {
            logger.warn(`Failed to remove temporary file: ${filePath}`, e);
          }
        }
      }

      return fullTranscription.trim();
    } catch (error) {
      logger.error('Error transcribing audio parts', error);
      throw error;
    }
  }

  /**
   * Sauvegarde une transcription dans un fichier
   * @param {string} transcription Texte transcrit
   * @param {string} outputPath Chemin du fichier de sortie
   * @returns {Promise<string>} Chemin du fichier de sortie
   */
  async saveTranscription(transcription, outputPath) {
    try {
      fs.writeFileSync(outputPath, transcription, { encoding: 'utf8' });
      logger.info(`Transcription saved to: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error(`Error saving transcription to: ${outputPath}`, error);
      throw error;
    }
  }
}

module.exports = new Transcriber();
const fs = require('fs');
const OpenAI = require('openai');
const config = require('config');
const logger = require('../utils/logger');

/**
 * Classe pour générer des résumés via l'API OpenAI
 */
class Summarizer {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = config.get('openai.summary_model');
    this.systemContent = config.get('openai.system_content').join('');
    this.userContent = config.get('openai.user_content');
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 secondes
  }

  /**
   * Génère un résumé à partir d'une transcription
   * @param {string} transcription Texte à résumer
   * @param {number} retryCount Compteur de tentatives
   * @returns {Promise<string>} Résumé généré
   */
  async generateSummary(transcription, retryCount = 0) {
    try {
      logger.info(`Generating summary (attempt ${retryCount + 1}/${this.maxRetries + 1})`);
      
      const openai = new OpenAI({
        apiKey: this.apiKey
      });

      const messages = [
        { role: 'system', content: this.systemContent },
        { role: 'user', content: `${this.userContent}${transcription}` },
      ];

      const response = await openai.chat.completions.create({
        model: this.model,
        messages: messages,
      });

      const summary = response.choices[0].message.content;
      logger.info('Summary generated successfully');
      return summary;
    } catch (error) {
      logger.error('Error generating summary', error);
      
      // Gérer les erreurs de l'API
      if (error.status === 429 || error.status >= 500) {
        if (retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount);
          logger.warn(`Rate limited or server error, retrying in ${delay}ms`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.generateSummary(transcription, retryCount + 1);
        }
      }
      
      throw new Error(`Summary generation failed after ${retryCount + 1} attempts: ${error.message}`);
    }
  }

  /**
   * Génère un résumé à partir d'un fichier de transcription
   * @param {string} transcriptionPath Chemin du fichier de transcription
   * @returns {Promise<string>} Résumé généré
   */
  async summarizeFromFile(transcriptionPath) {
    try {
      if (!fs.existsSync(transcriptionPath)) {
        logger.error(`Transcription file not found: ${transcriptionPath}`);
        throw new Error('Transcription file not found');
      }

      logger.info(`Reading transcription from file: ${transcriptionPath}`);
      const transcription = fs.readFileSync(transcriptionPath, 'utf-8');
      
      return await this.generateSummary(transcription);
    } catch (error) {
      logger.error(`Error summarizing from file: ${transcriptionPath}`, error);
      throw error;
    }
  }

  /**
   * Sauvegarde un résumé dans un fichier
   * @param {string} summary Résumé à sauvegarder
   * @param {string} outputPath Chemin du fichier de sortie
   * @returns {Promise<string>} Chemin du fichier de sortie
   */
  async saveSummary(summary, outputPath) {
    try {
      fs.writeFileSync(outputPath, summary, { encoding: 'utf8' });
      logger.info(`Summary saved to: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error(`Error saving summary to: ${outputPath}`, error);
      throw error;
    }
  }
}

module.exports = new Summarizer();
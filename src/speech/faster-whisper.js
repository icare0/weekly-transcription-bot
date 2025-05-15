// src/speech/faster-whisper.js
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');

class FasterWhisperTranscriber {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  async transcribeFile(filePath, retryCount = 0) {
    if (!fs.existsSync(filePath)) {
      logger.error(`File does not exist: ${filePath}`);
      throw new Error(`File does not exist: ${filePath}`);
    }

    try {
      logger.info(`Transcribing file: ${filePath} (attempt ${retryCount + 1}/${this.maxRetries + 1})`);
      
      return new Promise((resolve, reject) => {
        // Utiliser un script Python simple pour transcrire avec faster-whisper
        const pythonProcess = spawn('python', [
          '-c', 
          `
import sys
from faster_whisper import WhisperModel

try:
    # Charger le modèle (tiny ou base sont les plus rapides)
    model = WhisperModel("base")
    
    # Transcrire l'audio
    segments, info = model.transcribe("${filePath.replace(/\\/g, '\\\\')}")
    
    # Afficher le résultat
    full_text = ""
    for segment in segments:
        full_text += segment.text + " "
    
    print(full_text.strip())
    sys.exit(0)
except Exception as e:
    print(str(e), file=sys.stderr)
    sys.exit(1)
          `
        ]);
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            logger.info(`Transcription successful for file: ${filePath}`);
            resolve(stdout.trim());
          } else {
            logger.error(`Transcription process failed with code ${code}: ${stderr}`);
            reject(new Error(`Transcription failed: ${stderr}`));
          }
        });
      });
    } catch (error) {
      logger.error(`Error transcribing file: ${filePath}`, error);
      
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        logger.warn(`Retrying in ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.transcribeFile(filePath, retryCount + 1);
      }
      
      throw new Error(`Transcription failed after ${retryCount + 1} attempts: ${error.message}`);
    }
  }

  // Les autres méthodes de transcribe, saveTranscription, etc. restent identiques à celles de la classe Whisper
  // que j'ai partagée précédemment
  
  async transcribe(audioParts) {
    // La méthode est identique à celle que j'avais fournie
    // Elle appelle transcribeFile sur chaque partie audio et concatène les résultats
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
        
        // Nettoyer les fichiers temporaires
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

module.exports = new FasterWhisperTranscriber();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const logger = require('../utils/logger');
const { isValidFilePath } = require('../utils/validation');

/**
 * Convertit un fichier OGG en MP3
 * @param {string} oggPath Chemin du fichier OGG
 * @param {string} mp3Path Chemin du fichier MP3 de sortie
 * @returns {Promise<string>} Chemin du fichier MP3
 */
async function convertOggToMp3(oggPath, mp3Path) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(oggPath)) {
      logger.error(`OGG file not found: ${oggPath}`);
      return reject(new Error('OGG file not found'));
    }

    // Créer le dossier de destination s'il n'existe pas
    const mp3Dir = path.dirname(mp3Path);
    if (!fs.existsSync(mp3Dir)) {
      try {
        fs.mkdirSync(mp3Dir, { recursive: true });
        logger.info(`Created directory: ${mp3Dir}`);
      } catch (err) {
        logger.error(`Failed to create directory: ${mp3Dir}`, err);
        return reject(new Error(`Failed to create directory: ${mp3Dir}`));
      }
    }

    logger.info(`Converting OGG to MP3: ${oggPath} -> ${mp3Path}`);
    
    const ffmpegProcess = spawn(ffmpeg, [
      '-i', oggPath,
      '-codec:a', 'libmp3lame',
      '-q:a', '2',
      '-y',
      mp3Path,
    ]);

    let errorOutput = '';
    ffmpegProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        logger.info('OGG to MP3 conversion complete');
        resolve(mp3Path);
      } else {
        logger.error(`OGG to MP3 conversion failed with code ${code}`, errorOutput);
        reject(new Error('FFmpeg conversion failed'));
      }
    });

    ffmpegProcess.on('error', (err) => {
      logger.error('FFmpeg conversion error', err);
      reject(err);
    });
  });
}

/**
 * Obtient la durée d'un fichier audio
 * @param {string} filePath Chemin du fichier audio
 * @returns {Promise<number>} Durée en secondes
 */
async function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      logger.error(`Audio file not found: ${filePath}`);
      return reject(new Error('Audio file not found'));
    }

    const ffmpegProcess = spawn(ffmpeg, [
      '-i', filePath,
      '-f', 'null', '-'
    ]);

    let duration = 0;
    let errorOutput = '';
    
    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      
      const durationMatch = output.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
      if (durationMatch) {
        const hours = parseFloat(durationMatch[1]);
        const minutes = parseFloat(durationMatch[2]);
        const seconds = parseFloat(durationMatch[3]);
        duration = hours * 3600 + minutes * 60 + seconds;
      }
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        logger.debug(`Audio duration: ${duration} seconds`);
        resolve(duration);
      } else {
        logger.error(`Failed to get audio duration, exit code: ${code}`, errorOutput);
        reject(new Error('Failed to get audio duration'));
      }
    });

    ffmpegProcess.on('error', (err) => {
      logger.error('Error getting audio duration', err);
      reject(err);
    });
  });
}

/**
 * Divise un fichier audio en parties plus petites
 * @param {string} filePath Chemin du fichier audio
 * @param {number} maxFileSizeMB Taille maximale en MB
 * @returns {Promise<string[]>} Chemins des fichiers divisés
 */
async function splitAudioFile(filePath, maxFileSizeMB) {
  const maxFileSize_Bytes = maxFileSizeMB * 1024 * 1024;
  const fileExtension = path.extname(filePath).toLowerCase();
  const basePath = path.dirname(filePath);

  if (!isValidFilePath(filePath, path.join(__dirname, '../../../'))) {
    logger.error(`Invalid file path: ${filePath}`);
    throw new Error('Invalid file path');
  }

  if (fileExtension !== '.mp3') {
    logger.error(`Unsupported file format: ${fileExtension}`);
    throw new Error('Unsupported file format. Only MP3 files are supported.');
  }

  if (!fs.existsSync(filePath)) {
    logger.error(`File does not exist: ${filePath}`);
    throw new Error('File does not exist.');
  }

  const fileStats = fs.statSync(filePath);
  const fileSize = fileStats.size;

  if (fileSize <= maxFileSize_Bytes) {
    logger.info('File is already smaller than the maximum size, no splitting needed');
    return [filePath];
  }

  const duration = await getAudioDuration(filePath);
  const partDuration = (maxFileSize_Bytes / fileSize) * duration;

  logger.info(`Splitting file: ${filePath}, duration: ${duration}s, into parts of ${partDuration}s`);

  const partFiles = [];
  let startTime = 0;

  const baseName = path.basename(filePath, fileExtension);
  const dirName = path.dirname(filePath);

  let partIndex = 1;
  while (startTime < duration) {
    const partFilePath = path.join(
      dirName,
      `${baseName}_part${partIndex}${fileExtension}`
    );

    logger.debug(`Creating part ${partIndex}: ${startTime}s to ${startTime + partDuration}s`);

    try {
      await new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpeg, [
          '-i', filePath,
          '-ss', startTime.toFixed(2),
          '-t', partDuration.toFixed(2),
          '-c', 'copy',
          '-y',
          partFilePath,
        ]);

        let errorOutput = '';
        ffmpegProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            partFiles.push(partFilePath);
            resolve();
          } else {
            logger.error(`FFmpeg split failed with code ${code}`, errorOutput);
            reject(new Error('FFmpeg split failed'));
          }
        });

        ffmpegProcess.on('error', (err) => {
          logger.error('FFmpeg split error', err);
          reject(err);
        });
      });
    } catch (error) {
      logger.error(`Error splitting part ${partIndex}`, error);
      
      // Nettoyage en cas d'erreur
      partFiles.forEach(file => {
        try {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        } catch (e) {
          logger.error(`Error cleaning up partial file: ${file}`, e);
        }
      });
      
      throw error;
    }

    startTime += partDuration;
    partIndex++;
  }

  logger.info(`Successfully split file into ${partFiles.length} parts`);
  return partFiles;
}

module.exports = {
  convertOggToMp3,
  getAudioDuration,
  splitAudioFile
};
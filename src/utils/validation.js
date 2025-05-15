/**
 * Fonctions pour valider les entrées utilisateur
 */

/**
 * Valide un nom de réunion
 * @param {string} name Nom à valider
 * @returns {boolean} True si le nom est valide
 */
function isValidMeetingName(name) {
  // Nom de 3 à 30 caractères, lettres, chiffres, tirets, underscores uniquement
  const regex = /^[a-zA-Z0-9_-]{3,30}$/;
  return regex.test(name);
}

/**
 * Valide un chemin de fichier pour éviter les injections de chemin
 * @param {string} filePath Chemin à valider
 * @param {string} basePath Chemin de base autorisé
 * @returns {boolean} True si le chemin est valide
 */
function isValidFilePath(filePath, basePath) {
  const normalizedPath = require('path').normalize(filePath);
  return normalizedPath.startsWith(basePath);
}

/**
 * Valide et sanitize un nom de réunion
 * @param {string} name Nom brut
 * @returns {string} Nom sanitizé
 * @throws {Error} Si le nom est invalide
 */
function validateMeetingName(name) {
  if (!isValidMeetingName(name)) {
    throw new Error('Invalid meeting name. Use only letters, numbers, underscores and hyphens (3-30 chars).');
  }
  return name;
}

/**
 * Génère un nom de fichier sécurisé
 * @param {string} name Nom brut
 * @param {string} extension Extension du fichier (.mp3, .ogg, etc.)
 * @returns {string} Nom de fichier sécurisé
 */
function safeFileName(name, extension) {
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${sanitized}${extension}`;
}

module.exports = {
  isValidMeetingName,
  isValidFilePath,
  validateMeetingName,
  safeFileName
};
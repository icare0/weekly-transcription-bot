const express = require('express');
const { createCanvas } = require('canvas');
const path = require('path');
const crypto = require('crypto');

/**
 * Middleware pour générer des images placeholder dynamiques
 * @param {Object} app Express app
 */
function setupPlaceholderService(app) {
  // Endpoint pour générer des images placeholder
  app.get('/api/placeholder/:width/:height', (req, res) => {
    const width = parseInt(req.params.width, 10) || 100;
    const height = parseInt(req.params.height, 10) || 100;
    const text = req.query.text || '';
    const backgroundColor = req.query.bg || getRandomColor(text);
    const textColor = getContrastColor(backgroundColor);
    
    // Limiter la taille pour éviter les abus
    const safeWidth = Math.min(width, 800);
    const safeHeight = Math.min(height, 800);
    
    try {
      // Créer un canvas
      const canvas = createCanvas(safeWidth, safeHeight);
      const ctx = canvas.getContext('2d');
      
      // Dessiner le fond
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, safeWidth, safeHeight);
      
      // Dessiner le texte
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Déterminer la taille de police appropriée
      const fontSize = Math.min(safeWidth, safeHeight) * 0.4;
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      
      // Dessiner le texte au centre
      ctx.fillText(text.slice(0, 2).toUpperCase(), safeWidth / 2, safeHeight / 2);
      
      // Convertir le canvas en PNG
      const buffer = canvas.toBuffer('image/png');
      
      // Définir les en-têtes de réponse
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=86400', // Cache pendant 1 jour
      });
      
      // Envoyer l'image
      res.send(buffer);
    } catch (error) {
      console.error('Error generating placeholder image:', error);
      res.status(500).send('Error generating image');
    }
  });
  
  // Endpoint pour générer des avatars basés sur des ID
  app.get('/api/avatar/:id', (req, res) => {
    const id = req.params.id || 'default';
    const size = parseInt(req.query.size, 10) || 128;
    const safeSize = Math.min(size, 512); // Limiter la taille
    
    try {
      // Créer un avatar unique basé sur l'ID
      const canvas = createCanvas(safeSize, safeSize);
      const ctx = canvas.getContext('2d');
      
      // Générer une couleur déterministe basée sur l'ID
      const backgroundColor = getHashColor(id);
      const textColor = getContrastColor(backgroundColor);
      
      // Dessiner le fond
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, safeSize, safeSize);
      
      // Obtenir les initiales (1 ou 2 caractères)
      const initials = getInitials(id);
      
      // Dessiner le texte
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${safeSize * 0.4}px Arial, sans-serif`;
      ctx.fillText(initials, safeSize / 2, safeSize / 2);
      
      // Convertir le canvas en PNG
      const buffer = canvas.toBuffer('image/png');
      
      // Définir les en-têtes de réponse
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=86400', // Cache pendant 1 jour
      });
      
      // Envoyer l'image
      res.send(buffer);
    } catch (error) {
      console.error('Error generating avatar:', error);
      res.status(500).send('Error generating avatar');
    }
  });
}

/**
 * Génère une couleur de fond aléatoire mais déterministe basée sur un texte
 * @param {string} text Texte à utiliser pour la génération
 * @returns {string} Couleur au format hexadécimal
 */
function getRandomColor(text) {
  // Couleurs de base vives mais pas trop claires
  const colors = [
    '#4285F4', // Google Blue
    '#EA4335', // Google Red
    '#FBBC05', // Google Yellow
    '#34A853', // Google Green
    '#FF6D01', // Orange
    '#46BDC6', // Teal
    '#7B1FA2', // Purple
    '#C2185B', // Pink
    '#5E35B1', // Deep Purple
    '#00ACC1', // Cyan
  ];
  
  if (!text) {
    // Si pas de texte, couleur aléatoire
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  // Utiliser un hash simple pour sélectionner une couleur déterministe
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Génère une couleur basée sur un hash déterministe
 * @param {string} text Texte à transformer en hash
 * @returns {string} Couleur hexadécimale
 */
function getHashColor(text) {
  const hash = crypto.createHash('md5').update(text).digest('hex').slice(0, 6);
  return `#${hash}`;
}

/**
 * Détermine une couleur de texte contrastante (noir ou blanc) en fonction de la couleur de fond
 * @param {string} hexColor Couleur de fond au format hexadécimal
 * @returns {string} '#000000' pour le noir ou '#FFFFFF' pour le blanc
 */
function getContrastColor(hexColor) {
  // Enlever le # si présent
  const hex = hexColor.replace('#', '');
  
  // Convertir en RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calcul de la luminosité (formule YIQ)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  
  // Retourne du noir ou du blanc selon la luminosité
  return (yiq >= 128) ? '#000000' : '#FFFFFF';
}

/**
 * Extrait les initiales d'un texte
 * @param {string} text Texte à traiter
 * @returns {string} Initiales (1 ou 2 caractères)
 */
function getInitials(text) {
  if (!text) return '?';
  
  // Découper par espaces ou caractères spéciaux
  const words = text.split(/[^a-zA-Z0-9]/);
  const validWords = words.filter(word => word.length > 0);
  
  if (validWords.length === 0) {
    // Si pas de mots valides, prendre le premier caractère
    return text.charAt(0).toUpperCase();
  } else if (validWords.length === 1) {
    // Si un seul mot, prendre la première lettre
    return validWords[0].charAt(0).toUpperCase();
  } else {
    // Sinon, prendre les premières lettres des deux premiers mots
    return (validWords[0].charAt(0) + validWords[1].charAt(0)).toUpperCase();
  }
}

module.exports = setupPlaceholderService;
const djsv = require('@discordjs/voice');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const prism = require('prism-media');
const { PassThrough } = require('stream');
const ffmpeg = require('ffmpeg-static');
const config = require('config');
const logger = require('../utils/logger');
const { validateMeetingName, safeFileName } = require('../utils/validation');

// Configuration audio
const AUDIO_SETTINGS = {
  channels: 1,
  rate: 48000,
  frameSize: 960,
  bitrate: '64k',
  mixInterval: 20,
};

// Obtention de la durée maximale d'enregistrement en ms
let MAX_RECORDING_DURATION = 60 * 60 * 1000; // 1 heure par défaut
try {
  const maxMinutes = config.get('recording.max_duration_minutes');
  if (maxMinutes && maxMinutes > 0) {
    MAX_RECORDING_DURATION = maxMinutes * 60 * 1000;
  }
} catch (e) {
  logger.warn('No max recording duration configured, using default of 60 minutes');
}

/**
 * Classe pour gérer l'enregistrement audio dans Discord
 */
class AudioRecorder {
  constructor() {
    this.reset();
  }

  /**
   * Réinitialise l'état de l'enregistreur
   */
  reset() {
    this.connection = null;
    this.recordingProcess = null;
    this.mixingInterval = null;
    this.userBuffers = new Map();
    this.userStreams = new Map();
    this.currentMeeting = null;
    this.recordingTimeout = null;
    this.oggPath = null;
    this.participantsData = null;
    this.eventsTimeline = null;
    this.metadataPath = null;
    this.speakingStates = new Map();
    this.client = null;
  }

  /**
   * Commence l'enregistrement d'une réunion
   * @param {Object} interaction Interaction Discord
   * @param {string} meetingName Nom de la réunion
   * @param {Object} voiceChannel Canal vocal
   * @returns {string} Chemin du fichier d'enregistrement
   */
  async startRecording(interaction, meetingName, voiceChannel) {
    try {
      // Valider le nom de la réunion
      validateMeetingName(meetingName);
      
      // Sauvegarder une référence au client Discord
      this.client = interaction.client;
      
      // Créer le dossier pour la réunion
      const MEETINGS_DIR = path.join(__dirname, '../../meetings/');
      if (!fs.existsSync(MEETINGS_DIR)) {
        fs.mkdirSync(MEETINGS_DIR, { recursive: true });
      }
      
      const meetingFolder = path.join(MEETINGS_DIR, meetingName);
      if (!fs.existsSync(meetingFolder)) {
        fs.mkdirSync(meetingFolder, { recursive: true });
      }
      
      // Définir le chemin du fichier OGG
      this.oggPath = path.join(meetingFolder, safeFileName(meetingName, '.ogg'));
      
      // Définir le chemin du fichier metadata JSON
      this.metadataPath = path.join(meetingFolder, safeFileName(meetingName, '.json'));
      
      // Initialiser les structures de données pour les participants et la timeline
      this.participantsData = new Map();
      this.eventsTimeline = [];
      
      // Ajouter les membres actuels du canal vocal comme participants initiaux
      this.initializeParticipants(voiceChannel);
      
      // Rejoindre le canal vocal
      this.connection = djsv.joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true,
      });
      
      // Configurer les événements de connexion
      this.connection.on('stateChange', (oldState, newState) => {
        if (newState.status === djsv.VoiceConnectionStatus.Disconnected && 
            oldState.status !== newState.status) {
          logger.warn('Unexpected voice connection disconnection');
          this.stopRecording();
        }
      });
      
      // Configurer les événements du canal vocal pour suivre les entrées/sorties
      this.setupVoiceStateTracking(voiceChannel);
      
      // Définir le nom de la réunion actuelle
      this.currentMeeting = meetingName;
      
      // Démarrer le processus d'enregistrement FFmpeg
      this.recordingProcess = spawn(ffmpeg, [
        '-f', 's16le',
        '-ar', AUDIO_SETTINGS.rate.toString(),
        '-ac', AUDIO_SETTINGS.channels.toString(),
        '-i', 'pipe:0',
        '-c:a', 'libopus',
        '-b:a', AUDIO_SETTINGS.bitrate,
        '-application', 'voip',
        '-flush_packets', '1',
        '-vn', '-y',
        this.oggPath,
      ]);
      
      this.recordingProcess.on('error', (err) => {
        logger.error('Recording process error', err);
        this.stopRecording();
      });
      
      this.recordingProcess.on('close', async (code) => {
        if (code !== 0) {
          logger.error(`FFmpeg process closed with code ${code}`);
        }
        
        if (!fs.existsSync(this.oggPath)) {
          logger.error('OGG file does not exist after recording');
        } else {
          logger.info(`Recording saved to ${this.oggPath}`);
        }
      });
      
      // Initialiser le tampon utilisateur
      this.userBuffers = new Map();
      
      // Configurer l'intervalle de mixage
      this.setupMixingInterval();
      
      // Configurer le récepteur audio
      this.setupAudioReceiver();
      
      // Configurer un timeout pour la durée maximale
      this.recordingTimeout = setTimeout(() => {
        logger.warn(`Recording exceeded maximum duration of ${MAX_RECORDING_DURATION/60000} minutes`);
        interaction.channel.send(`⚠️ Recording exceeded maximum duration of ${MAX_RECORDING_DURATION/60000} minutes. Stopping automatically.`);
        this.stopRecording();
      }, MAX_RECORDING_DURATION);
      
      logger.info(`Started recording for meeting: ${meetingName}`);
      return this.oggPath;
    } catch (error) {
      logger.error('Error starting recording', error);
      this.stopRecording();
      throw error;
    }
  }

  /**
   * Initialize participants data from voice channel
   * @param {Object} voiceChannel Voice channel
   */
  initializeParticipants(voiceChannel) {
    // Get all members in the voice channel
    voiceChannel.members.forEach(member => {
      if (!member.user.bot) {
        const userData = {
          id: member.id,
          username: member.user.username,
          displayName: member.displayName,
          avatarURL: member.user.displayAvatarURL({ format: 'png', size: 128 }),
          joinTime: Date.now(),
          leaveTime: null,
          isMuted: member.voice.mute || member.voice.selfMute,
          isDeafened: member.voice.deaf || member.voice.selfDeaf,
          speakingTimes: [],
          totalSpeakingTime: 0
        };
        
        this.participantsData.set(member.id, userData);
        
        // Add a join event to timeline (at start of recording)
        this.eventsTimeline.push({
          type: 'join',
          userId: member.id,
          username: member.user.username,
          displayName: member.displayName,
          timestamp: Date.now(),
          recordingTimestamp: 0 // Start of recording
        });
      }
    });
  }

  /**
   * Set up voice state tracking for user joins and leaves
   * @param {Object} voiceChannel Voice channel to track
   */
  setupVoiceStateTracking(voiceChannel) {
    if (!this.client) {
      logger.warn('Cannot setup voice state tracking: client not available');
      return;
    }
    
    // Listen for voice state updates
    this.client.on('voiceStateUpdate', (oldState, newState) => {
      // Skip bot events
      if (oldState.member.user.bot || newState.member.user.bot) return;
      
      const userId = oldState.id || newState.id;
      const now = Date.now();
      const recordingTime = (now - (this.participantsData.get(this.participantsData.keys().next().value)?.joinTime || now)) / 1000;
      
      // User joined the voice channel
      if (oldState.channelId !== voiceChannel.id && newState.channelId === voiceChannel.id) {
        const userData = {
          id: userId,
          username: newState.member.user.username,
          displayName: newState.member.displayName,
          avatarURL: newState.member.user.displayAvatarURL({ format: 'png', size: 128 }),
          joinTime: now,
          leaveTime: null,
          isMuted: newState.mute || newState.selfMute,
          isDeafened: newState.deaf || newState.selfDeaf,
          speakingTimes: [],
          totalSpeakingTime: 0
        };
        
        this.participantsData.set(userId, userData);
        
        // Add join event to timeline
        this.eventsTimeline.push({
          type: 'join',
          userId: userId,
          username: newState.member.user.username,
          displayName: newState.member.displayName,
          timestamp: now,
          recordingTimestamp: recordingTime
        });
        
        logger.info(`User ${newState.member.user.username} joined the voice channel`);
      }
      
      // User left the voice channel
      else if (oldState.channelId === voiceChannel.id && newState.channelId !== voiceChannel.id) {
        const userData = this.participantsData.get(userId);
        
        if (userData) {
          userData.leaveTime = now;
          
          // Add leave event to timeline
          this.eventsTimeline.push({
            type: 'leave',
            userId: userId,
            username: oldState.member.user.username,
            displayName: oldState.member.displayName,
            timestamp: now,
            recordingTimestamp: recordingTime
          });
          
          logger.info(`User ${oldState.member.user.username} left the voice channel`);
        }
      }
      
      // User muted/unmuted or deafened/undeafened
      else if (oldState.channelId === voiceChannel.id && newState.channelId === voiceChannel.id) {
        const userData = this.participantsData.get(userId);
        
        if (userData) {
          // Mute status changed
          if (oldState.mute !== newState.mute || oldState.selfMute !== newState.selfMute) {
            const isMuted = newState.mute || newState.selfMute;
            userData.isMuted = isMuted;
            
            this.eventsTimeline.push({
              type: isMuted ? 'mute' : 'unmute',
              userId: userId,
              username: newState.member.user.username,
              displayName: newState.member.displayName,
              timestamp: now,
              recordingTimestamp: recordingTime
            });
            
            logger.info(`User ${newState.member.user.username} ${isMuted ? 'muted' : 'unmuted'}`);
          }
          
          // Deafen status changed
          if (oldState.deaf !== newState.deaf || oldState.selfDeaf !== newState.selfDeaf) {
            const isDeafened = newState.deaf || newState.selfDeaf;
            userData.isDeafened = isDeafened;
            
            this.eventsTimeline.push({
              type: isDeafened ? 'deafen' : 'undeafen',
              userId: userId,
              username: newState.member.user.username,
              displayName: newState.member.displayName,
              timestamp: now,
              recordingTimestamp: recordingTime
            });
            
            logger.info(`User ${newState.member.user.username} ${isDeafened ? 'deafened' : 'undeafened'}`);
          }
        }
      }
    });
  }

  /**
   * Configure l'intervalle de mixage audio
   */
  setupMixingInterval() {
    this.mixingInterval = setInterval(() => {
      const chunkSize = AUDIO_SETTINGS.rate * 2 * (AUDIO_SETTINGS.mixInterval / 1000);
      
      const users = Array.from(this.userBuffers.entries());
      if (users.length === 0) return;
      
      const userChunks = [];
      for (const [userId, user] of users) {
        const available = user.buffer.length - user.position;
        const bytesToRead = Math.min(available, chunkSize);
        let chunk;
        
        if (bytesToRead > 0) {
          chunk = user.buffer.subarray(user.position, user.position + bytesToRead);
          user.position += bytesToRead;
          
          // Libérer la mémoire si nous avons lu tout le buffer
          if (user.position >= user.buffer.length) {
            user.buffer = Buffer.alloc(0);
            user.position = 0;
          }
        } else {
          chunk = Buffer.alloc(0);
        }
        
        // Ajouter du padding si nécessaire
        if (chunk.length < chunkSize) {
          const padding = Buffer.alloc(chunkSize - chunk.length);
          chunk = Buffer.concat([chunk, padding]);
        }
        
        userChunks.push(chunk);
      }
      
      // Mixer les chunks
      const mixedBuffer = Buffer.alloc(chunkSize);
      const mixedSamples = new Int16Array(mixedBuffer.buffer, mixedBuffer.byteOffset, chunkSize / 2);
      mixedSamples.fill(0);
      
      for (const chunk of userChunks) {
        const userSamples = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.length / 2);
        for (let i = 0; i < userSamples.length; i++) {
          const sum = mixedSamples[i] + userSamples[i];
          // Éviter l'écrêtage
          mixedSamples[i] = Math.max(-32768, Math.min(32767, sum));
        }
      }
      
      // Écrire dans le processus FFmpeg
      if (this.recordingProcess && !this.recordingProcess.stdin.destroyed) {
        this.recordingProcess.stdin.write(mixedBuffer);
      }
    }, AUDIO_SETTINGS.mixInterval);
  }

  /**
   * Configure le récepteur audio
   */
  setupAudioReceiver() {
    if (!this.connection) return;
    
    const receiver = this.connection.receiver;
    this.userStreams = new Map();
    this.speakingStates = new Map();
    
    // Événement quand un utilisateur commence à parler
    receiver.speaking.on('start', (userId) => {
      if (this.userStreams.has(userId)) return;
      
      const now = Date.now();
      const recordingTime = (now - (this.participantsData.get(this.participantsData.keys().next().value)?.joinTime || now)) / 1000;
      
      // Update speaking state
      this.speakingStates.set(userId, {
        speaking: true,
        startTime: now,
        recordingStartTime: recordingTime
      });
      
      // Add to the timeline
      this.eventsTimeline.push({
        type: 'startSpeaking',
        userId: userId,
        username: this.getUsernameById(userId),
        displayName: this.getDisplayNameById(userId),
        timestamp: now,
        recordingTimestamp: recordingTime
      });
      
      // Update participant data
      const userData = this.participantsData.get(userId);
      if (userData) {
        userData.speakingTimes.push({
          start: now,
          startRecording: recordingTime,
          end: null,
          endRecording: null
        });
      }
      
      const opusDecoder = new prism.opus.Decoder({
        rate: AUDIO_SETTINGS.rate,
        channels: AUDIO_SETTINGS.channels,
        frameSize: AUDIO_SETTINGS.frameSize,
      });
      
      const audioStream = receiver.subscribe(userId, {
        end: {
          behavior: djsv.EndBehaviorType.AfterSilence,
          duration: 200,
        },
      });
      
      const pcmStream = new PassThrough();
      
      audioStream.pipe(opusDecoder).pipe(pcmStream);
      
      this.userBuffers.set(userId, { buffer: Buffer.alloc(0), position: 0 });
      
      pcmStream.on('data', (chunk) => {
        const user = this.userBuffers.get(userId);
        if (user) {
          user.buffer = Buffer.concat([user.buffer, chunk]);
          
          // Limiter la taille du buffer pour éviter les fuites de mémoire
          const maxBufferSize = 5 * 1024 * 1024; // 5MB
          if (user.buffer.length > maxBufferSize) {
            user.buffer = user.buffer.subarray(user.position);
            user.position = 0;
          }
        }
      });
      
      this.userStreams.set(userId, {
        audioStream,
        opusDecoder,
        pcmStream,
      });
      
      logger.info(`User ${this.getUsernameById(userId)} started speaking`);
    });
    
    // Événement quand un utilisateur arrête de parler
    receiver.speaking.on('end', (userId) => {
      const streamInfo = this.userStreams.get(userId);
      if (streamInfo) {
        streamInfo.audioStream.destroy();
        streamInfo.opusDecoder.destroy();
        streamInfo.pcmStream.destroy();
        this.userBuffers.delete(userId);
        this.userStreams.delete(userId);
      }
      
      const now = Date.now();
      const recordingTime = (now - (this.participantsData.get(this.participantsData.keys().next().value)?.joinTime || now)) / 1000;
      
      // Update speaking state
      const speakingState = this.speakingStates.get(userId);
      if (speakingState && speakingState.speaking) {
        speakingState.speaking = false;
        speakingState.endTime = now;
        speakingState.recordingEndTime = recordingTime;
        
        // Calculate speaking duration
        const duration = (now - speakingState.startTime) / 1000; // in seconds
        
        // Add to the timeline
        this.eventsTimeline.push({
          type: 'stopSpeaking',
          userId: userId,
          username: this.getUsernameById(userId),
          displayName: this.getDisplayNameById(userId),
          timestamp: now,
          recordingTimestamp: recordingTime,
          duration: duration
        });
        
        // Update participant data
        const userData = this.participantsData.get(userId);
        if (userData && userData.speakingTimes.length > 0) {
          const lastSpeakingTime = userData.speakingTimes[userData.speakingTimes.length - 1];
          if (!lastSpeakingTime.end) {
            lastSpeakingTime.end = now;
            lastSpeakingTime.endRecording = recordingTime;
            
            const speakingDuration = (now - lastSpeakingTime.start) / 1000;
            userData.totalSpeakingTime += speakingDuration;
          }
        }
        
        logger.info(`User ${this.getUsernameById(userId)} stopped speaking (duration: ${duration.toFixed(1)}s)`);
      }
    });
  }

  /**
   * Get username by user ID
   * @param {string} userId Discord user ID
   * @returns {string} Username or "Unknown User"
   */
  getUsernameById(userId) {
    const userData = this.participantsData.get(userId);
    return userData ? userData.username : "Unknown User";
  }

  /**
   * Get display name by user ID
   * @param {string} userId Discord user ID
   * @returns {string} Display name or "Unknown User"
   */
  getDisplayNameById(userId) {
    const userData = this.participantsData.get(userId);
    return userData ? userData.displayName : "Unknown User";
  }

  /**
   * Save meeting metadata to JSON
   */
  saveMetadata() {
    try {
      if (!this.metadataPath) {
        logger.error('Cannot save metadata: path not defined');
        return;
      }
      
      // Convert participants data Map to array for JSON serialization
      const participants = Array.from(this.participantsData.values());
      
      // Create metadata object
      const metadata = {
        meetingName: this.currentMeeting,
        startTime: participants.length > 0 ? Math.min(...participants.map(p => p.joinTime)) : Date.now(),
        endTime: Date.now(),
        participants: participants,
        events: this.eventsTimeline
      };
      
      // Write to file
      fs.writeFileSync(this.metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
      logger.info(`Meeting metadata saved to ${this.metadataPath}`);
    } catch (error) {
      logger.error('Error saving meeting metadata', error);
    }
  }

  /**
   * Arrête l'enregistrement en cours
   */
  async stopRecording() {
    try {
      // Annuler le timeout de durée maximale
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
        this.recordingTimeout = null;
      }
      
      // Nettoyer l'intervalle de mixage
      if (this.mixingInterval) {
        clearInterval(this.mixingInterval);
        this.mixingInterval = null;
      }
      
      // Save metadata before stopping
      this.saveMetadata();
      
      // Traiter les dernières données audio
      if (this.userBuffers && this.recordingProcess && !this.recordingProcess.stdin.destroyed) {
        const chunkSize = AUDIO_SETTINGS.rate * 2 * (AUDIO_SETTINGS.mixInterval / 1000);
        const mixedBuffer = Buffer.alloc(chunkSize);
        const mixedSamples = new Int16Array(mixedBuffer.buffer, mixedBuffer.byteOffset, chunkSize / 2);
        mixedSamples.fill(0);
        
        for (const [, user] of this.userBuffers) {
          const available = user.buffer.length - user.position;
          if (available > 0) {
            const chunk = user.buffer.subarray(user.position, user.position + available);
            const userSamples = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.length / 2);
            for (let i = 0; i < userSamples.length; i++) {
              const sum = i < mixedSamples.length ? mixedSamples[i] + userSamples[i] : userSamples[i];
              if (i < mixedSamples.length) {
                mixedSamples[i] = Math.max(-32768, Math.min(32767, sum));
              }
            }
          }
        }
        
        this.recordingProcess.stdin.write(mixedBuffer);
      }
      
      // Terminer le processus d'enregistrement
      if (this.recordingProcess) {
        if (!this.recordingProcess.stdin.destroyed) {
          this.recordingProcess.stdin.end();
        }
        
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            logger.warn('FFmpeg process did not close in time, forcing kill');
            this.recordingProcess.kill('SIGKILL');
            resolve();
          }, 5000);
          
          this.recordingProcess.on('close', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        
        this.recordingProcess = null;
      }
      
      // Nettoyer les flux audio
      if (this.userStreams) {
        for (const [, streamInfo] of this.userStreams) {
          if (streamInfo.audioStream) streamInfo.audioStream.destroy();
          if (streamInfo.opusDecoder) streamInfo.opusDecoder.destroy();
          if (streamInfo.pcmStream) streamInfo.pcmStream.destroy();
        }
        this.userStreams.clear();
        this.userStreams = null;
      }
      
      // Nettoyer les buffers
      if (this.userBuffers) {
        this.userBuffers.clear();
        this.userBuffers = null;
      }
      
      // Déconnecter du canal vocal
      if (this.connection) {
        this.connection.destroy();
        this.connection = null;
      }
      
      const meetingName = this.currentMeeting;
      const metadataPath = this.metadataPath;
      this.currentMeeting = null;
      
      logger.info(`Stopped recording for meeting: ${meetingName}`);
      return { meetingName, oggPath: this.oggPath, metadataPath };
    } catch (error) {
      logger.error('Error stopping recording', error);
      throw error;
    } finally {
      this.reset();
    }
  }

  /**
   * Vérifie si un enregistrement est actuellement en cours
   * @returns {boolean} True si un enregistrement est en cours
   */
  isRecording() {
    return !!this.recordingProcess && !!this.connection;
  }

  /**
   * Obtient le nom de la réunion en cours d'enregistrement
   * @returns {string|null} Nom de la réunion ou null si aucun enregistrement
   */
  getCurrentMeetingName() {
    return this.currentMeeting;
  }
}

module.exports = new AudioRecorder();
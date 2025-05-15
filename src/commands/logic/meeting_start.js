const { MessageFlags } = require('discord.js');
const AsyncLock = require('async-lock');
const recorder = require('../../audio/recorder');
const permissions = require('../../discord/permissions');
const embeds = require('../../utils/embeds');
const state = require('../../utils/state');
const logger = require('../../utils/logger');
const { validateMeetingName } = require('../../utils/validation');

const stateLock = new AsyncLock();

module.exports = {
  async execute(interaction) {
    // Vérifier les permissions
    if (!await permissions.checkPermission(interaction)) return;
    
    // Vérifier que la commande n'est pas exécutée dans un thread
    if (!await permissions.checkNotInThread(interaction)) return;

    await stateLock.acquire('recording', async () => {
      try {
        // Vérifier si un enregistrement est déjà en cours
        if (recorder.isRecording()) {
          return await interaction.reply({
            embeds: [embeds.recordingAlreadyStartedEmbed],
            flags: MessageFlags.Ephemeral,
          });
        }

        // Récupérer le nom de la réunion
        const meetingName = interaction.options.getString('name');

        try {
          // Valider le nom de la réunion
          validateMeetingName(meetingName);
        } catch (error) {
          return await interaction.reply({
            content: `❌ ${error.message}`,
            flags: MessageFlags.Ephemeral,
          });
        }

        // Vérifier si une réunion avec ce nom existe déjà
        if (state.meetings.some(m => m.name === meetingName)) {
          return await interaction.reply({
            embeds: [embeds.meetingAlreadyExistsEmbed],
            flags: MessageFlags.Ephemeral,
          });
        }

        // Vérifier si l'utilisateur est dans un canal vocal
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
          return await interaction.reply({
            embeds: [embeds.noVoiceChannelEmbed],
            flags: MessageFlags.Ephemeral,
          });
        }

        try {
          // Démarrer l'enregistrement
          await recorder.startRecording(interaction, meetingName, voiceChannel);
          
          // Mettre à jour l'état global (pour compatibilité)
          state.currentMeeting = meetingName;
          
          await interaction.reply({ 
            embeds: [embeds.recordingStartedEmbed(meetingName)]
          });
          
          logger.info(`Recording started for meeting: ${meetingName} by ${interaction.user.tag}`);
        } catch (error) {
          logger.error(`Failed to start recording: ${error.message}`, error);
          await interaction.reply({ 
            embeds: [embeds.errorWhileRecordingEmbed]
          });
          
          // Nettoyage en cas d'erreur
          if (recorder.isRecording()) {
            await recorder.stopRecording();
          }
        }
      } catch (error) {
        logger.error('Unexpected error in meeting_start command', error);
        await interaction.reply({
          content: '❌ An unexpected error occurred. Please check the logs.',
          flags: MessageFlags.Ephemeral,
        });
      }
    });
  },
};
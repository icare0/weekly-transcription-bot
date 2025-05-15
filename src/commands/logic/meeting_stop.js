const path = require('path');
const fs = require('fs');
const AsyncLock = require('async-lock');
const { MessageFlags } = require('discord.js');
const permissions = require('../../discord/permissions');
const recorder = require('../../audio/recorder');
const converter = require('../../audio/converter');
const transcriber = require('../../openai/transcriber');
const summarizer = require('../../openai/summarizer');
const messaging = require('../../discord/messaging');
const embeds = require('../../utils/embeds');
const logger = require('../../utils/logger');
const state = require('../../utils/state');
const config = require('config');

const stateLock = new AsyncLock();
const MEETINGS_DIR = path.join(__dirname, '../../../meetings/');

module.exports = {
  async execute(interaction) {
    // Vérifier les permissions
    if (!await permissions.checkPermission(interaction)) return;

    await stateLock.acquire('recording', async () => {
      try {
        // Vérifier si un enregistrement est en cours
        if (!recorder.isRecording()) {
          return await interaction.reply({
            embeds: [embeds.noActiveRecordingEmbed],
            flags: MessageFlags.Ephemeral,
          });
        }

        try {
          await interaction.reply({ embeds: [embeds.processingAudioEmbed] });
          
          // Arrêter l'enregistrement
          logger.info('Stopping recording and cleaning up resources...');
          const { meetingName, oggPath, metadataPath } = await recorder.stopRecording();
          
          if (!meetingName || !oggPath) {
            throw new Error('Recording stopped but meeting name or OGG path is missing');
          }
          
          // Réinitialiser l'état global (pour compatibilité)
          state.currentMeeting = null;
          
          const meetingPath = path.join(MEETINGS_DIR, meetingName);
          const mp3Path = path.join(meetingPath, `${meetingName}.mp3`);

          // Vérifier que le fichier OGG existe
          if (!fs.existsSync(oggPath)) {
            logger.error(`OGG file not found: ${oggPath}`);
            await interaction.editReply({ embeds: [embeds.errorWhileRecordingEmbed] });
            return;
          }

          // Mettre à jour l'état des réunions
          state.meetings.push({
            name: meetingName,
            recorded: true,
            transcribed: false,
            summarized: false,
            hasMetadata: !!metadataPath && fs.existsSync(metadataPath)
          });

          // Informer l'utilisateur que l'enregistrement est arrêté
          await interaction.editReply({ embeds: [embeds.recordingStoppedEmbed] });
          
          // Créer un thread pour suivre le traitement
          const message = await interaction.fetchReply();
          const thread = await message.startThread({
            name: `Traitement de la réunion '${meetingName}'`,
          });

          // 1. Convertir OGG en MP3
          logger.info('Converting OGG to MP3...');
          const msg1 = await thread.send({ embeds: [embeds.convertingStartedEmbed] });
          try {
            await converter.convertOggToMp3(oggPath, mp3Path);
            await msg1.edit({ embeds: [embeds.convertingSuccessEmbed] });
          } catch (err) {
            logger.error('Error converting OGG to MP3', err);
            await msg1.edit({ embeds: [embeds.convertingFailedEmbed] });
            throw new Error('Conversion failed');
          }

          // 2. Diviser le fichier MP3 si nécessaire
          logger.info('Starting audio splitting...');
          const msg2 = await thread.send({ embeds: [embeds.splittingStartedEmbed] });
          let audioParts;
          try {
            audioParts = await converter.splitAudioFile(mp3Path, config.get('openai.transcription_max_size_MB'));
            logger.info(`Audio splitting successful. Parts: ${audioParts.length}`);
            await msg2.edit({
              embeds: [embeds.splittingSuccessEmbed(audioParts.length)],
            });
          } catch (err) {
            logger.error('Error while splitting the file', err);
            await msg2.edit({ embeds: [embeds.splittingFailedEmbed] });
            throw new Error('Splitting failed');
          }

          // 3. Transcrire l'audio
          logger.info('Starting transcription...');
          const msg3 = await thread.send({ embeds: [embeds.transcriptionStartedEmbed] });
          let transcription, transcriptionFile;
          try {
            transcription = await transcriber.transcribe(audioParts);
            
            if (!transcription) {
              logger.error('Transcription failed - empty result');
              await msg3.edit({ embeds: [embeds.transcriptionFailedEmbed] });
              throw new Error('Transcription failed - empty result');
            }

            // Sauvegarder la transcription
            logger.info('Saving transcription to file...');
            transcriptionFile = path.join(meetingPath, `${meetingName}.txt`);
            await transcriber.saveTranscription(transcription, transcriptionFile);
            
            // Mettre à jour l'état
            const meetingIndex = state.meetings.findIndex(m => m.name === meetingName);
            if (meetingIndex !== -1) {
              state.meetings[meetingIndex].transcribed = true;
            }
            
            await msg3.edit({ embeds: [embeds.transcriptionCompletedEmbed] });
          } catch (err) {
            logger.error('Error during transcription', err);
            await msg3.edit({ embeds: [embeds.transcriptionFailedEmbed] });
            throw new Error('Transcription failed');
          }

          // 4. Générer un résumé
          logger.info('Starting summary generation...');
          const msg4 = await thread.send({ embeds: [embeds.summaryStartedEmbed] });
          let summary;
          try {
            summary = await summarizer.summarizeFromFile(transcriptionFile);
            
            if (!summary) {
              logger.error('Summary generation failed - empty result');
              await msg4.edit({ embeds: [embeds.summaryFailedEmbed] });
              throw new Error('Summary generation failed - empty result');
            }

            // Sauvegarder le résumé
            logger.info('Saving summary to file...');
            const summaryFile = path.join(meetingPath, `${meetingName}.md`);
            await summarizer.saveSummary(summary, summaryFile);
            
            // Mettre à jour l'état
            const meetingIndex = state.meetings.findIndex(m => m.name === meetingName);
            if (meetingIndex !== -1) {
              state.meetings[meetingIndex].summarized = true;
            }
            
            await msg4.edit({ embeds: [embeds.summaryCompletedEmbed] });
          } catch (err) {
            logger.error('Error during summary generation', err);
            await msg4.edit({ embeds: [embeds.summaryFailedEmbed] });
            throw new Error('Summary failed');
          }

          // 5. Envoyer le résumé dans le thread
          logger.info('Sending summary to thread...');
          await messaging.sendSummary(summary, thread);
          
          // 6. Générer les informations de la réunion pour l'interface web
          if (metadataPath && fs.existsSync(metadataPath)) {
            const msg5 = await thread.send({ 
              embeds: [new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(':bar_chart: Participant Data Available')
                .setDescription('Participant data has been recorded for this meeting. You can view who was speaking in the web interface.')
                .setTimestamp()
              ] 
            });
          }
          
          await interaction.editReply({ embeds: [embeds.processingSuccessEmbed] });
          
          logger.info(`Meeting processing completed successfully: ${meetingName}`);
        } catch (error) {
          logger.error('Stop command error', error);
          await interaction.editReply({ 
            embeds: [embeds.processingFailedEmbed(error.message || 'Unknown error')] 
          });
        }
      } catch (error) {
        logger.error('Unexpected error in meeting_stop command', error);
        await interaction.reply({
          content: '❌ An unexpected error occurred. Please check the logs.',
          flags: MessageFlags.Ephemeral,
        });
      } finally {
        // S'assurer que l'état est nettoyé
        state.connection = null;
        state.recordingProcess = null;
        state.userBuffers = null;
        state.userStreams = null;
        state.currentMeeting = null;
      }
    });
  },
};
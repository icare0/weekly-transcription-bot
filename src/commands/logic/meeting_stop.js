const state = require('../../utils/state.js');
const path = require('path');
const fs = require('fs');
const AsyncLock = require('async-lock');

const {
  waitForDrain,
  splitAudioFile,
  transcribe,
  summarizeTranscription,
  sendLongMessageToThread
} = require('../../utils/utils.js');

const {
  noPermissionEmbed,
  noActiveRecordingEmbed,
  recordingStoppedEmbed,
  transcriptionFailedEmbed,
  summaryFailedEmbed,
  splittingStartedEmbed,
  splittingFailedEmbed,
  splittingSuccessEmbed,
  transcriptionCompletedEmbed,
  transcriptionStartedEmbed,
  summaryCompletedEmbed,
  summaryStartedEmbed,
  processingSuccessEmbed,
  processingFailedEmbed,
  errorWhileRecordingEmbed
} = require('../../utils/embeds.js');

const config = require('../../../config.json');

const stateLock = new AsyncLock();

module.exports = {
  async execute(interaction) {
    await interaction.deferReply();

    const memberRoles = interaction.member.roles.cache.map(role => role.name);
    const hasPermission = memberRoles.some(role => config.allowed_roles.includes(role));

    if(!hasPermission)
      return await interaction.editReply({ embeds: [noPermissionEmbed], ephemeral: true });

    await stateLock.acquire('recording', async () => {
      if(!state.recordingProcess || !state.connection)
        return await interaction.editReply({ embeds: [noActiveRecordingEmbed], ephemeral: true });

      try {
        console.log('Stopping connection and audio mixer...');
        if(state.connection) {
          state.connection.destroy();
          state.connection = null;
        }

        if(state.audioMixer) {
          state.audioMixer.end();
          await waitForDrain(state.audioMixer);
        }

        if(state.recordingProcess) {
          console.log('Stopping recording process...');
          state.recordingProcess.stdin.end();
          await new Promise(resolve => state.recordingProcess.once('close', resolve));
        }

        const meetingPath = path.join(__dirname, '..', '..', '..', 'meetings', state.currentMeeting);
        const mp3Path = path.join(meetingPath, `${state.currentMeeting}.mp3`);

        console.log(`Checking if MP3 file exists at: ${mp3Path}`);
        if(!fs.existsSync(mp3Path)) {
          console.error('MP3 file not found!');
          await interaction.editReply({ embeds: [errorWhileRecordingEmbed] });
          return;
        }

        console.log('Updating meeting state...');
        state.meetings.push({
          name: state.currentMeeting,
          recorded: true,
          transcribed: false,
          summarized: false
        });

        console.log('Sending recording stopped embed...');
        await interaction.editReply({ embeds: [recordingStoppedEmbed] });
        const message = await interaction.fetchReply();
        const thread = await message.startThread({
          name: `Summary of the meeting '${state.currentMeeting}'`,
        });

        console.log('Starting audio splitting...');
        const msg2 = await thread.send({ embeds: [splittingStartedEmbed] });
        let audioPath = mp3Path;
        let audioParts = [audioPath];

        try {
          audioParts = await splitAudioFile(audioPath, config.transcription_max_size_MB);
          console.log(`Audio splitting successful. Parts: ${audioParts.length}`);
          await msg2.edit({ embeds: [splittingSuccessEmbed(audioParts.length)] });
        } catch(err) {
          console.error('Error while splitting the file: ', err);
          await msg2.edit({ embeds: [splittingFailedEmbed] });
          throw err;
        }

        console.log('Starting transcription...');
        const msg3 = await thread.send({ embeds: [transcriptionStartedEmbed] });
        const transcription = await transcribe(audioParts);

        if(!transcription) {
          console.error('Transcription failed!');
          await msg3.edit({ embeds: [transcriptionFailedEmbed] });
          throw new Error('Transcription failed');
        }

        console.log('Saving transcription to file...');
        const transcriptionFile = path.join(meetingPath, `${state.currentMeeting}.txt`);
        fs.writeFileSync(transcriptionFile, transcription, { encoding: 'utf8' });
        await msg3.edit({ embeds: [transcriptionCompletedEmbed] });

        console.log('Starting summary generation...');
        const msg4 = await thread.send({ embeds: [summaryStartedEmbed] });
        const summary = await summarizeTranscription(transcriptionFile, msg4);

        if(!summary) {
          console.error('Summary generation failed!');
          await msg4.edit({ embeds: [summaryFailedEmbed] });
          throw new Error('Summary failed');
        }

        console.log('Saving summary to file...');
        const summaryFile = path.join(meetingPath, `${state.currentMeeting}.md`);
        fs.writeFileSync(summaryFile, summary, { encoding: 'utf8' });
        await msg4.edit({ embeds: [summaryCompletedEmbed] });

        console.log('Sending summary to thread...');
        await sendLongMessageToThread(thread, summary);
        await interaction.editReply({ embeds: [processingSuccessEmbed] });

      } catch(error) {
        console.error('Stop command error:', error);
        await interaction.editReply({ embeds: [processingFailedEmbed] });
      } finally {
        console.log('Cleaning up state...');
        state.connection = null;
        state.recordingProcess = null;
        state.audioMixer = null;
        state.cleanupRecording = null;
        state.currentMeeting = null;
      }
    });
  }
};
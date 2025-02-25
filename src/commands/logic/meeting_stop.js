const state = require('../../utils/state.js');
const path = require('path');
const fs = require('fs');

const {
  convertWavToMp3,
  splitAudioFile,
  transcribe,
  summarizeTranscription,
  sendLongMessageToThread
} = require('../../utils/utils.js');

const {
  noPermissionEmbed,
  noActiveRecordingEmbed,
  recordingStoppedEmbed,
  recordingFailedEmbed,
  transcriptionFailedEmbed,
  summaryFailedEmbed,
  conversionFailedEmbed,
  conversionStartedEmbed,
  conversionSuccessEmbed,
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

module.exports = {
  async execute(interaction) {
    const memberRoles = interaction.member.roles.cache.map(role => role.name);
    const hasPermission = memberRoles.some(role => config.allowed_roles.includes(role));

    if(!hasPermission)
      return await interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });

    if(!state.recordingProcess || !state.connection)
      return await interaction.reply({ embeds: [noActiveRecordingEmbed], ephemeral: true });

    state.recordingProcess.stdin.end();
    state.recordingProcess.kill();
    state.recordingProcess = null;

    state.connection.destroy();
    state.connection = null;

    state.meetings.push({
      name: state.currentMeeting,
      recorded: true,
      transcribed: false,
      summarized: false
    });

    if(state.finishedRecordingCode === 1)
      return await interaction.reply({ embeds: [recordingFailedEmbed] });

    const meetingPath = path.join(__dirname, '..', '..', '..', 'meetings', state.currentMeeting);

    await interaction.reply({ embeds: [recordingStoppedEmbed] });
    const message = await interaction.fetchReply();

    const thread = await message.startThread({
      name: `Summary of the meeting '${state.currentMeeting}'`,
    });

    const msg1 = await thread.send({ embeds: [conversionStartedEmbed] });

    const wavPath = path.join(meetingPath, `${state.currentMeeting}.wav`);
    const mp3Path = wavPath.replace('.wav', '.mp3');

    if(!fs.existsSync(wavPath)) {
      await msg1.edit({ embeds: [errorWhileRecordingEmbed] });
      state.currentMeeting = null;
      await interaction.editReply({ embeds: [processingFailedEmbed] });
      return;
    }

    let audioPath = wavPath;

    await convertWavToMp3(wavPath, mp3Path)
      .then(async () => {
        msg1.edit({ embeds: [conversionSuccessEmbed] });

        fs.unlink(wavPath, async (err) => {
          if(err) {
            console.error(`Failed to delete WAV file: ${err}`);
            await thread.send({ embeds: [wavDeletionFailedEmbed] });
          } else {
            console.log('WAV file deleted successfully');
          }
        });

        audioPath = mp3Path;
      })
      .catch(async (error) => {
        console.error('Conversion error:', error);
        await msg1.edit({ embeds: [conversionFailedEmbed] });
      });

    const msg2 = await thread.send({ embeds: [splittingStartedEmbed] });

    let audioParts = [audioPath];

    splitAudioFile(audioPath, config.transcription_max_size_MB)
      .then(async (parts) => {
        audioParts = parts;
        await msg2.edit({ embeds: [splittingSuccessEmbed(parts.length)] });
      })
      .catch(async (err) => {
        console.error('Error while splitting the file: ', err);
        state.currentMeeting = null;
        await msg2.edit({ embeds: [splittingFailedEmbed] });
        await interaction.editReply({ embeds: [processingFailedEmbed] });
        return;
      });

    const msg3 = await thread.send({ embeds: [transcriptionStartedEmbed] });

    const transcription = await transcribe(audioParts, msg3);

    if(!transcription) {
      await msg3.edit({ embeds: [transcriptionFailedEmbed] });
      state.currentMeeting = null;
      await interaction.editReply({ embeds: [processingFailedEmbed] });
      return;
    }

    const transcriptionFile = path.join(meetingPath, `${state.currentMeeting}.txt`);
    fs.writeFileSync(transcriptionFile, transcription, { encoding: 'utf8' });

    await msg3.edit({ embeds: [transcriptionCompletedEmbed] });

    const msg4 = await thread.send({ embeds: [summaryStartedEmbed] });

    const summary = await summarizeTranscription(transcriptionFile, msg4);

    if(!summary) {
      await msg4.edit({ embeds: [summaryFailedEmbed] });
      state.currentMeeting = null;
      await interaction.editReply({ embeds: [processingFailedEmbed] });
      return;
    }

    const summaryFile = path.join(meetingPath, `${state.currentMeeting}.md`);
    fs.writeFileSync(summaryFile, summary, { encoding: 'utf8' });

    await msg4.edit({ embeds: [summaryCompletedEmbed] });

    await sendLongMessageToThread(thread, summary);
    await interaction.editReply({ embeds: [processingSuccessEmbed] });

    state.currentMeeting = null;
  }
};

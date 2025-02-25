const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const prism = require('prism-media');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const state = require('../../utils/state.js');
const config = require('../../../config.json');

const {
  recordingStartedEmbed,
  recordingAlreadyStartedEmbed,
  noPermissionEmbed,
  meetingAlreadyExistsEmbed,
  noVoiceChannelEmbed,
  errorWhileRecordingEmbed
} = require('../../utils/embeds.js');

module.exports = {
  async execute(interaction) {
    const memberRoles = interaction.member.roles.cache.map(role => role.name);
    const hasPermission = memberRoles.some(role => config.allowed_roles.includes(role));

    if(!hasPermission)
      return await interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });

    if(state.currentMeeting)
      return await interaction.reply({ embeds: [recordingAlreadyStartedEmbed], ephemeral: true });

    const meetingName = interaction.options.getString('name');

    if(state.meetings.map(m => m.name).includes(meetingName))
      return await interaction.reply({ embeds: [meetingAlreadyExistsEmbed], ephemeral: true });

    const voiceChannel = interaction.member.voice.channel;
    if(!voiceChannel)
      return await interaction.reply({ embeds: [noVoiceChannelEmbed], ephemeral: true });

    state.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true
    });

    state.currentMeeting = meetingName;
    await interaction.reply({ embeds: [recordingStartedEmbed] });

    const MEETINGS_DIR = path.join(__dirname, '../../../meetings/');
    const meetingFolder = path.join(MEETINGS_DIR, state.currentMeeting);

    if(!fs.existsSync(meetingFolder))
      fs.mkdirSync(meetingFolder, { recursive: true });

    const wavPath = path.join(meetingFolder, `${state.currentMeeting}.wav`);
    state.recordingProcess = spawn(ffmpeg, [
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '1',
      '-i', 'pipe:0',
      '-y',
      wavPath
    ]);

    state.recordingProcess.on('error', (err) => {
      console.error("Recording process error: ", err);
      interaction.editReply({ embeds: [errorWhileRecordingEmbed] });
    });

    state.recordingProcess.on('close', async (code) => {
      state.finishedRecordingCode = code;

      if(!fs.existsSync(wavPath)) {
        console.error('WAV file does not exist');
        state.meetings = state.meetings.filter(m => m.name !== state.currentMeeting);
        state.currentMeeting = null;
        await interaction.editReply({ embeds: [errorWhileRecordingEmbed] });
        
        try {
          fs.rmSync(meetingFolder, { recursive: true, force: true });
          console.log(`Deleted meeting folder: ${meetingFolder}`);
        } catch (err) {
          console.error(`Failed to delete meeting folder: ${meetingFolder}`, err);
        }

        return;
      }
    });

    const subscribedUsers = new Set();

    const receiver = state.connection.receiver;
    receiver.speaking.on('start', (userId) => {
      if(subscribedUsers.has(userId)) return;

      const audioStream = receiver.subscribe(userId, {
        end: {
          behaviour: EndBehaviorType.AfterSilence,
          duration: 300
        }
      });

      subscribedUsers.add(userId);

      const opusDecoder = new prism.opus.Decoder({
        rate: 48000,
        channels: 1
      });

      audioStream.pipe(opusDecoder).pipe(state.recordingProcess.stdin);
    });
  }
};
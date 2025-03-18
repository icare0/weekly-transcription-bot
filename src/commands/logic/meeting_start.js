const { joinVoiceChannel, EndBehaviorType, VoiceConnectionStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const prism = require('prism-media');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const { PassThrough } = require('stream');
const state = require('../../utils/state.js');
const config = require('../../../config.json');
const AsyncLock = require('async-lock');
const { waitForDrain } = require('../../utils/utils.js');

const {
  recordingStartedEmbed,
  recordingAlreadyStartedEmbed,
  noPermissionEmbed,
  meetingAlreadyExistsEmbed,
  noVoiceChannelEmbed,
  errorWhileRecordingEmbed
} = require('../../utils/embeds.js');

const stateLock = new AsyncLock();

class PCMixer extends PassThrough {
  constructor() {
    super();
    this.streams = new Set();
    this.buffer = Buffer.alloc(0);
    this.frameSize = 48000 * 0.020 * 2;
    
    this.mixingInterval = setInterval(() => this.mixFrames(), 20).unref();
  }

  addStream(stream) {
    this.streams.add(stream);
    stream.on('data', chunk => this.queueChunk(chunk));
    stream.on('end', () => this.streams.delete(stream));
  }

  queueChunk(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
  }

  mixFrames() {
    if(this.streams.size === 0) return;

    const frame = Buffer.alloc(this.frameSize);
    let samplesMixed = 0;

    while(this.buffer.length >= this.frameSize) {
      const chunk = this.buffer.slice(0, this.frameSize);
      this.buffer = this.buffer.slice(this.frameSize);

      for(let i = 0; i < chunk.length; i += 2) {
        const sample = chunk.readInt16LE(i);
        const mixed = frame.readInt16LE(i) || 0;
        frame.writeInt16LE(Math.min(32767, Math.max(-32768, mixed + sample * 0.5)), i);
      }
      samplesMixed++;
    }

    if(samplesMixed > 0) {
      this.push(frame);
    }
  }

  destroy() {
    clearInterval(this.mixingInterval);
    super.destroy();
  }
}

module.exports = {
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const memberRoles = interaction.member.roles.cache.map(role => role.name);
    const hasPermission = memberRoles.some(role => config.allowed_roles.includes(role));

    if(!hasPermission)
      return await interaction.editReply({ embeds: [noPermissionEmbed], ephemeral: true });

    await stateLock.acquire('recording', async () => {
      if(state.currentMeeting)
        return await interaction.editReply({ embeds: [recordingAlreadyStartedEmbed], ephemeral: true });

      const meetingName = interaction.options.getString('name');

      if(state.meetings.map(m => m.name).includes(meetingName))
        return await interaction.editReply({ embeds: [meetingAlreadyExistsEmbed], ephemeral: true });

      const voiceChannel = interaction.member.voice.channel;
      if(!voiceChannel)
        return await interaction.editReply({ embeds: [noVoiceChannelEmbed], ephemeral: true });

      try {
        state.connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guild.id,
          adapterCreator: interaction.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: true
        });

        if(!state.connection) {
          return await interaction.editReply({ embeds: [errorWhileRecordingEmbed] });
        }

        state.currentMeeting = meetingName;
        await interaction.editReply({ embeds: [recordingStartedEmbed] });

        const MEETINGS_DIR = path.join(__dirname, '../../../meetings/');
        const meetingFolder = path.join(MEETINGS_DIR, state.currentMeeting);

        if(!fs.existsSync(meetingFolder))
          fs.mkdirSync(meetingFolder, { recursive: true });

        const mp3Path = path.join(meetingFolder, `${state.currentMeeting}.mp3`);

        state.audioMixer = new PCMixer();

        state.recordingProcess = spawn(ffmpeg, [
          '-thread_queue_size', '4096',
          '-f', 's16le',
          '-ar', '48000',
          '-ac', '1',
          '-i', 'pipe:0',
          '-codec:a', 'libmp3lame',
          '-q:a', '2',
          '-y',
          mp3Path
        ]);

        state.cleanupRecording = async () => {
          if(state.audioMixer) {
            state.audioMixer.end();
            await waitForDrain(state.audioMixer);
          }

          if(state.recordingProcess) {
            state.recordingProcess.stdin.end();
            await new Promise(resolve => state.recordingProcess.once('close', resolve));
          }

          for(const [userId, streamInfo] of userStreams) {
            streamInfo.audioStream.destroy();
            streamInfo.pcmStream.destroy();
            streamInfo.opusDecoder.destroy();
          }
          userStreams.clear();
        };

        state.recordingProcess.on('error', (err) => {
          console.error("Recording process error: ", err);
          interaction.editReply({ embeds: [errorWhileRecordingEmbed] });
          state.connection.destroy();
          state.connection = null;
        });

        state.recordingProcess.on('close', async (code) => {
          state.finishedRecordingCode = code;
          if(!fs.existsSync(mp3Path)) {
            console.error('MP3 file does not exist');
            await interaction.editReply({ embeds: [errorWhileRecordingEmbed] });
          } else {
            console.log('Recording saved successfully');
          }
        });

        state.audioMixer.pipe(state.recordingProcess.stdin);

        const receiver = state.connection.receiver;
        const userStreams = new Map();

        receiver.speaking.on('start', (userId) => {
          if(userStreams.has(userId)) return;

          const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 1 });
          const pcmStream = new PassThrough();

          const audioStream = receiver.subscribe(userId, {
            end: {
              behaviour: EndBehaviorType.AfterSilence,
              duration: 100
            }
          });

          audioStream
            .pipe(opusDecoder)
            .pipe(pcmStream);

          if(state.audioMixer) {
            state.audioMixer.addStream(pcmStream);
            userStreams.set(userId, { audioStream, opusDecoder, pcmStream });
          } else {
            console.error('Audio mixer is not initialized');
          }
        });

        receiver.speaking.on('end', (userId) => {
          const streamInfo = userStreams.get(userId);
          if(streamInfo) {
            streamInfo.audioStream.destroy();
            streamInfo.opusDecoder.destroy();
            streamInfo.pcmStream.destroy();
            userStreams.delete(userId);
          }
        });

        state.connection.on('stateChange', (oldState, newState) => {
          if(newState.status === VoiceConnectionStatus.Disconnected) {
            console.error('Unexpected disconnection!');
            state.cleanupRecording();
            state.connection.destroy();
            state.connection = null;
          }
        });
      } catch(error) {
        console.error('Meeting start error:', error);
        if(state.connection) {
          state.connection.destroy();
          state.connection = null;
        }
        await interaction.editReply({ embeds: [errorWhileRecordingEmbed] });
      }
    });
  }
};
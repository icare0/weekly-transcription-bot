const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const OpenAI = require('openai');

const config = require('../../config.json');
const state = require('./state');

const getAudioDuration = async (filePath) => {
  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn(ffmpeg, [
      '-i', filePath,
      '-f', 'null', '-'
    ]);

    let duration = 0;
    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString();
      const durationMatch = output.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
      if(durationMatch) {
        const hours = parseFloat(durationMatch[1]);
        const minutes = parseFloat(durationMatch[2]);
        const seconds = parseFloat(durationMatch[3]);
        duration = hours * 3600 + minutes * 60 + seconds;
      }
    });

    ffmpegProcess.on('close', (code) => {
      if(code === 0) {
        resolve(duration);
      } else {
        reject(new Error('Failed to get audio duration'));
      }
    });

    ffmpegProcess.on('error', (err) => {
      reject(err);
    });
  });
};

const waitForDrain = async (stream) => {
  return new Promise((resolve) => {
    if(stream.writableLength > 0) {
      const check = () => {
        if(stream.writableLength === 0) resolve();
        else stream.once('drain', check);
      };
      check();
    } else {
      resolve();
    }
  });
};

module.exports = {
  cleanupRecording: async (audioMixer, recordingProcess, userStreams) => {
    if(audioMixer) {
      audioMixer.destroy();
      audioMixer.close();
      await waitForDrain(audioMixer);
    }

    if(recordingProcess) {
      recordingProcess.stdin.end();
      await new Promise((resolve) =>
        recordingProcess.once('close', resolve)
      );
    }

    for(const [, streamInfo] of userStreams) {
      streamInfo.audioStream.destroy();
      streamInfo.pcmStream.destroy();
      streamInfo.opusDecoder.destroy();
      if(audioMixer) {
        audioMixer.removeInput(streamInfo.mixerInput);
      }
    }

    userStreams.clear();
    state.userStreams = null;
    state.recordingProcess = null;
    state.audioMixer = null;
  },

  convertWavToMp3: async (wavPath, mp3Path) => {
    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn(ffmpeg, [
        '-i', wavPath,
        '-codec:a', 'libmp3lame',
        '-q:a', '2',
        '-y',
        mp3Path,
      ]);

      ffmpegProcess.on('close', (code) => {
        if(code === 0) {
          console.log('WAV to MP3 conversion complete.');
          resolve();
        } else {
          console.error('WAV to MP3 conversion failed!');
          reject(new Error('FFmpeg conversion failed'));
        }
      });

      ffmpegProcess.on('error', (err) => {
        console.error('FFmpeg conversion error:', err);
        reject(err);
      });
    });
  },

  splitAudioFile: async (filePath, maxFileSize_MB) => {
    const maxFileSize_Bytes = maxFileSize_MB * 1024 * 1024;
    const fileExtension = path.extname(filePath).toLowerCase();
  
    if(!['.mp3', '.wav'].includes(fileExtension))
      throw new Error('Unsupported file format. Only MP3 and WAV files are supported.');
  
    if(!fs.existsSync(filePath))
      throw new Error('File does not exist.');
  
    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;
  
    if(fileSize <= maxFileSize_Bytes)
      return [filePath];
  
    const duration = await getAudioDuration(filePath);
    const partDuration = (maxFileSize_Bytes / fileSize) * duration;
  
    const partFiles = [];
    let startTime = 0;
  
    const baseName = path.basename(filePath, fileExtension);
    const dirName = path.dirname(filePath);
  
    while(startTime < duration) {
      const partFilePath = path.join(
        dirName,
        `${baseName}_part${partFiles.length + 1}${fileExtension}`
      );
  
      const ffmpegProcess = spawn(ffmpeg, [
        '-i', filePath,
        '-ss', startTime.toFixed(2),
        '-t', partDuration.toFixed(2),
        '-c', 'copy',
        '-y',
        partFilePath,
      ]);

      await new Promise((resolve, reject) => {
        ffmpegProcess.on('close', (code) => {
          if(code === 0) {
            partFiles.push(partFilePath);
            resolve();
          } else {
            reject(new Error('FFmpeg split failed'));
          }
        });
  
        ffmpegProcess.on('error', (err) => {
          reject(err);
        });
      });
  
      startTime += partDuration;
    }
  
    return partFiles;
  },

  transcribe: async (audioParts) => {
    let fullTranscription = '';

    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    try {
      for(const filePath of audioParts) {
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: config.transcription_model,
          language: config.transcription_language,
        });

        fullTranscription += transcription.text + ' ';
        fs.unlinkSync(filePath);
      }

      return fullTranscription.trim();
    } catch(e) {
      console.error('Error transcribing audio:', e.message);
      throw new Error('Transcription failed');
    }
  },

  summarizeTranscription: async (transcriptionPath) => {
    try {
      const transcription = fs.readFileSync(transcriptionPath, 'utf-8');

      const messages = [
        { role: 'system', content: config.system_content.join('') },
        { role: 'user', content: `${config.user_content}${transcription}` },
      ];

      const openai = new OpenAI(process.env.OPENAI_API_KEY);

      const response = await openai.chat.completions.create({
        model: config.summary_model,
        messages: messages,
      });

      return response.choices[0].message.content;
    } catch(e) {
      console.error('Error while summarizing:', e.message);
      throw new Error('Summary failed');
    }
  },

  sendLongMessageToThread: async (thread, message) => {
    const lines = message.split('\n');
    let messageChunk = '';

    for(const line of lines) {
      if((messageChunk + '\n' + line).length > 2000) {
        await thread.send(messageChunk);
        messageChunk = line;
      } else {
        messageChunk += (messageChunk ? '\n' : '') + line;
      }
    }

    if(messageChunk) {
      await thread.send(messageChunk);
    }
  },

  waitForDrain,
};

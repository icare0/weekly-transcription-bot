const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs');
const OpenAI = require('openai');
const path = require('path');

const config = require('../../config.json');

module.exports = {
  async convertWavToMp3(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn(ffmpeg, [
        '-i', inputPath,
        '-acodec', 'libmp3lame',
        '-b:a', '128k',
        '-y',
        outputPath
      ]);

      ffmpegProcess.on('close', (code) => {
        if(code === 0 || code === null) {
          resolve(outputPath);
        } else {
          reject(`FFmpeg finished with code: ${code}`);
        }
      });

      ffmpegProcess.on('error', (err) => {
        reject(`Error during ffmpeg launch: ${err.message}`);
      });
    });
  },

  async splitAudioFile(filePath, maxFileSize_MB) {
    const sizeInBytes = fs.statSync(filePath).size;
    if(sizeInBytes <= maxFileSize_MB * 1024 * 1024)
      return [filePath];

    const maxTime = {
      ".wav": Math.floor(maxFileSize_MB * 10.41), //? 1MB = 10.42sec (48000, mono, 16bit)
      ".mp3": Math.floor(maxFileSize_MB * 62.5)   //? 1MB = 62.50sec (128kbps)
    }
    
    const fileExtension = path.extname(filePath);
    const baseName = path.basename(filePath, fileExtension) ;
    const outputDir = path.dirname(filePath);

    const outputPattern = path.join(outputDir, `${baseName}_part%03d${fileExtension}`);

    const ffmpegArgs = [
      '-i', filePath,
      '-f', 'segment',
      '-segment_time', `${maxTime[fileExtension]}`,
      '-c', 'copy',
      '-reset_timestamps', '1',
      outputPattern,
    ];

    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs)

      ffmpegProcess.on('close', (code) => {
        if(code === 0 || code === null) {
          const files = fs.readdirSync(outputDir);
          const partFiles = files.filter((file) => file.startsWith(`${baseName}_part`) && file.endsWith(fileExtension));
          resolve(partFiles.map((file) => path.join(outputDir, file)));
        } else {
          reject(new Error(`FFmpeg finished with code: ${code}`));
        }
      })

      ffmpegProcess.stderr.on('data', (data) => {
        console.error(`FFmpeg stderr: ${data}`);
      })
    })
  },

  async transcribe(audioParts, message) {
    let fullTranscription = "";

    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    if(audioParts.length === 1) {

      try {
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(audioParts[0]),
          model: config.transcription_model,
          language: config.transcription_language
        });

        fullTranscription += transcription.text + " ";
      } catch(e) {
        console.error(`Error transcribing ${audioParts[0]}:`, e.message);
        return null;
      }
    } else {
      for(const filePath of audioParts) {
        try {
          const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: config.transcription_model,
            language: config.transcription_language
          });

          fullTranscription += transcription.text + " "
        } catch(e) {
          console.error(`Error transcribing ${filePath}:`, e.message);
          return null;
        }

        fs.unlinkSync(filePath);
      }
    }

    return fullTranscription.trim();
  },

  async summarizeTranscription(transcriptionPath, message) {
    try {
      const transcription = fs.readFileSync(transcriptionPath, "utf-8");
  
      const messages = [
        { role: "system", content: config.system_content.join("") },
        { role: "user", content: `${config.user_content}${transcription}` }
      ];
      
      const openai = new OpenAI(process.env.OPENAI_API_KEY);

      const response = await openai.chat.completions.create({
        model: config.summary_model,
        messages: messages
      });

      return response.choices[0].message.content;
    } catch(e) {
      console.error("Error while summarizing: ", e.message);
      return null
    }
  },

  async sendLongMessageToThread(thread, summary) {
    const lines = summary.split("\n");
    let messageChunk = "";
  
    for(const line of lines) {
      if((messageChunk + "\n" + line).length > 2000)
        await thread.send(messageChunk);
      else 
        messageChunk += (messageChunk ? "\n" : "") + line;
    }
  
    if(messageChunk)
      await thread.send(messageChunk);
  },
}
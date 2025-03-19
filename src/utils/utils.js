const fs = require('fs');
const OpenAI = require('openai');
const path = require('path');

const config = require('../../config.json');

module.exports = {
  async splitAudioFile(filePath, maxFileSize_MB) {
    const maxFileSize_Bytes = maxFileSize_MB * 1024 * 1024;
    const fileExtension = path.extname(filePath).toLowerCase();
  
    if(fileExtension !== '.mp3')
      throw new Error('Unsupported file format. Only MP3 files are supported.');
  
    if(!fs.existsSync(filePath))
      throw new Error('File does not exist.');
  
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fileBuffer.length;
  
    if(fileSize <= maxFileSize_Bytes)
      return [filePath];
  
    const partFiles = [];
    let start = 0;
  
    while(start < fileSize) {
      const end = Math.min(start + maxFileSize_Bytes, fileSize);
      const chunk = fileBuffer.slice(start, end);
      const partFilePath = `${filePath}_part${partFiles.length + 1}`;
      fs.writeFileSync(partFilePath, chunk);
      partFiles.push(partFilePath);
      start = end;
    }
  
    return partFiles;
  },

  async transcribe(audioParts) {
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
      if((messageChunk + "\n" + line).length > 2000) {
        await thread.send(messageChunk);
        messageChunk = line;
      } else 
        messageChunk += (messageChunk ? "\n" : "") + line;
    }
  
    if(messageChunk)
      await thread.send(messageChunk);
  },

  async waitForDrain(stream) {
    return new Promise(resolve => {
      if (stream.writableLength > 0) {
        const check = () => {
          if (stream.writableLength === 0) resolve();
          else stream.once('drain', check);
        };
        check();
      } else {
        resolve();
      }
    });
  },
}
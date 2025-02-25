const { EmbedBuilder } = require('discord.js');

module.exports = {
  recordingStartedEmbed: new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(':red_circle: Recording Started')
    .setDescription('The meeting recording has started successfully.')
    .setTimestamp(),

  recordingStoppedEmbed: new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(':octagonal_sign: Recording Stopped')
    .setDescription('The meeting recording has been stopped.')
    .setTimestamp(),

  transcriptionStartedEmbed: new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(':scroll: Transcription Started')
    .setDescription('The meeting transcription has started successfully.')
    .setTimestamp(),

  transcriptionCompletedEmbed: new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(':white_check_mark: Transcription Completed')
    .setDescription('The transcription has been successfully generated.')
    .setTimestamp(),

  transcriptionFailedEmbed: new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(':x: Transcription Failed')
    .setDescription('An error occurred while generating the transcription.')
    .setTimestamp(),

  summaryStartedEmbed: new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(':page_facing_up: Summary Started')
    .setDescription('The meeting summary is being generated.')
    .setTimestamp(),

  summaryCompletedEmbed: new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(':white_check_mark: Summary Completed')
    .setDescription('The meeting summary has been successfully generated.')
    .setTimestamp(),

  summaryFailedEmbed: new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(':x: Summary Failed')
    .setDescription('An error occurred while generating the summary.')
    .setTimestamp(),

  meetingDeletedEmbed: new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(':wastebasket: Meeting Deleted')
    .setDescription('The meeting has been successfully deleted.')
    .setTimestamp(),

  fileDeletedEmbed: new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(':floppy_disk: Recording Deleted')
    .setDescription('A recording file has been successfully deleted.')
    .setTimestamp(),
  
  noPermissionEmbed: new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(':no_entry_sign: You do not have permission to use this command')
    .setDescription('You lack the necessary permissions to execute this command.')
    .setTimestamp(),

  recordingAlreadyStartedEmbed: new EmbedBuilder()
    .setColor(0xffcc00)
    .setTitle(':warning: A meeting is already being recorded')
    .setDescription('Please stop the current recording before starting a new one.')
    .setTimestamp(),

  meetingAlreadyExistsEmbed: new EmbedBuilder()
    .setColor(0xffcc00)
    .setTitle(':warning: A meeting with this name already exists')
    .setDescription('Please choose a different name for the new meeting.')
    .setTimestamp(),

  noVoiceChannelEmbed: new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(':warning: You have to be in a voice chat')
    .setDescription('Please join a voice channel before using this command.')
    .setTimestamp(),

  errorWhileRecordingEmbed: new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(':x: Error while recording')
    .setDescription('An error occurred while the recording.')
    .setTimestamp(),

  conversionStartedEmbed: new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(':arrows_counterclockwise: Conversion Started')
    .setDescription('The WAV file is being converted to MP3...')
    .setTimestamp(),

  conversionSuccessEmbed: new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(':white_check_mark: Converted to MP3')
    .setDescription('The WAV file has been successfully converted to MP3.')
    .setTimestamp(),

  conversionFailedEmbed: new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(':x: Conversion Failed')
    .setDescription('An error occurred while converting the WAV file to MP3.')
    .setTimestamp(),

  wavDeletionFailedEmbed: new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(':x: Deleting the WAV file failed')
    .setDescription('Failed to delete the original WAV file after conversion.')
    .setTimestamp(),

  splittingStartedEmbed: new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(':arrows_counterclockwise: Splitting Audio File')
    .setDescription('Splitting the file into chunks of the configured max size.')
    .setTimestamp(),

  splittingSuccessEmbed: (numParts) => new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(':white_check_mark: Splitting Complete')
    .setDescription(numParts === 1 
      ? 'No splitting was needed. The file is within the allowed size limit.' 
      : `The file has been split into ${numParts} parts successfully.`)
    .setTimestamp(),

  splittingFailedEmbed: new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(':x: Failed to Split File')
    .setDescription('An error occurred while splitting the audio file.')
    .setTimestamp(),

  processingSuccessEmbed: new EmbedBuilder()
    .setColor(0x00ff00) 
    .setTitle(':white_check_mark: Meeting Processed Successfully')
    .setDescription('The recording was transcribed and summarized successfully.')
    .addFields(
      { name: ':scroll: Transcription',   value: ':white_check_mark: Completed', inline: true },
      { name: ':page_facing_up: Summary', value: ':white_check_mark: Generated', inline: true }
    )
    .setTimestamp(),

  meetingDoesNotExistEmbed: new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(':x: Meeting Does Not Exist')
    .setDescription('The meeting you are trying to access does not exist.')
    .setTimestamp(),

  noRecordingsExistEmbed: new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(':x: No Recordings Found')
    .setDescription('There are no recordings associated with this meeting.')
    .setTimestamp(),
  
  processingFailedEmbed: new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(':x: Processing Failed')
    .setDescription('An error occurred while processing the meeting.')
    .setTimestamp(),

};

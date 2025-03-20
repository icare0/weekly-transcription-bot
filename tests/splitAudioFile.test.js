const fs = require('fs');
const path = require('path');
const { splitAudioFile } = require('../src/utils/utils.js');

describe('splitAudioFile', () => {
  const testMp3FilePath = path.join(__dirname, 'assets', 'test.mp3');
  const testWavFilePath = path.join(__dirname, 'assets', 'test.wav');
  const maxFileSize_MB = 2;

  beforeAll(() => {
    if(!fs.existsSync(testMp3FilePath))
      throw new Error('test.mp3 file is missing. Please add it to the test directory.');
    if(!fs.existsSync(testWavFilePath)) 
      throw new Error('test.wav file is missing. Please add it to the test directory.');
  });

  it('should split a large MP3 file into chunks and log file sizes', async () => {
    const fileStats = fs.statSync(testMp3FilePath);
    const fileSize_MB = fileStats.size / (1024 * 1024);
    const expectedParts = Math.ceil(fileSize_MB / maxFileSize_MB);

    const partFiles = await splitAudioFile(testMp3FilePath, maxFileSize_MB);

    expect(partFiles.length).toBe(expectedParts);

    partFiles.forEach((file, index) => {
      const partFileStats = fs.statSync(file);
      const partFileSize_MB = partFileStats.size / (1024 * 1024);
      console.log(`MP3 Part ${index + 1}: ${partFileSize_MB.toFixed(2)} MB (${file})`);
    });

    partFiles.forEach((file) => {
      expect(fs.existsSync(file)).toBe(true);
    });

    partFiles.forEach((file) => {
      fs.unlinkSync(file);
    });
  }, 10000);

  it('should split a large WAV file into chunks and log file sizes', async () => {
    const fileStats = fs.statSync(testWavFilePath);
    const fileSize_MB = fileStats.size / (1024 * 1024);
    const expectedParts = Math.ceil(fileSize_MB / maxFileSize_MB);

    const partFiles = await splitAudioFile(testWavFilePath, maxFileSize_MB);

    expect(partFiles.length).toBe(expectedParts);

    partFiles.forEach((file, index) => {
      const partFileStats = fs.statSync(file);
      const partFileSize_MB = partFileStats.size / (1024 * 1024);
      console.log(`WAV Part ${index + 1}: ${partFileSize_MB.toFixed(2)} MB (${file})`);
    });

    partFiles.forEach((file) => {
      expect(fs.existsSync(file)).toBe(true);
    });

    partFiles.forEach((file) => {
      fs.unlinkSync(file);
    });
  }, 10000);

  it('should throw an error for unsupported file formats', async () => {
    const invalidFilePath = path.join(__dirname, 'test.txt');
    fs.writeFileSync(invalidFilePath, 'This is a test file.');

    await expect(
      splitAudioFile(invalidFilePath, maxFileSize_MB)
    ).rejects.toThrow(
      'Unsupported file format. Only MP3 and WAV files are supported.'
    );

    fs.unlinkSync(invalidFilePath);
  }, 10000);
});
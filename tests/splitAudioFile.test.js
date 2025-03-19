const fs = require('fs');
const path = require('path');
const { splitAudioFile } = require('../src/utils/utils.js');

describe('splitAudioFile', () => {
  const testFilePath = path.join(__dirname, 'assets', 'test.mp3');
  const maxFileSize_MB = 2;

  beforeAll(() => {
    if(!fs.existsSync(testFilePath))
      throw new Error('test.mp3 file is missing. Please add it to the test directory.');
  });

  it('should split a large MP3 file into exactly 3 parts and log file sizes', async () => {
    const fileStats = fs.statSync(testFilePath);
    const fileSize_MB = fileStats.size / (1024 * 1024);
    const expectedParts = Math.ceil(fileSize_MB / maxFileSize_MB);

    if(expectedParts < 3)
      throw new Error(`Test file is too small to be split into 3 parts. File size: ${fileSize_MB} MB, maxFileSize_MB: ${maxFileSize_MB}`);

    const partFiles = await splitAudioFile(testFilePath, maxFileSize_MB, false);

    expect(partFiles.length).toBe(3);

    partFiles.forEach((file, index) => {
      const partFileStats = fs.statSync(file);
      const partFileSize_MB = partFileStats.size / (1024 * 1024);
      console.log(`Part ${index + 1}: ${partFileSize_MB.toFixed(2)} MB`);
    });

    partFiles.forEach((file) => {
      expect(fs.existsSync(file)).toBe(true);
    });

    partFiles.forEach((file) => {
      fs.unlinkSync(file);
    });
  });

  it('should throw an error for unsupported file formats', async () => {
    const invalidFilePath = path.join(__dirname, 'test.txt');
    fs.writeFileSync(invalidFilePath, 'This is a test file.');
  
    await expect(splitAudioFile(invalidFilePath, maxFileSize_MB)).rejects.toThrow(
      'Unsupported file format. Only MP3 files are supported.'
    );
  
    fs.unlinkSync(invalidFilePath);
  });
});
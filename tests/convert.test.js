const fs = require('fs');
const path = require('path');
const { convertWavToMp3 } = require('../src/utils/utils.js');

describe('convertWavToMp3', () => {
  const assetsDir = path.join(__dirname, 'assets');
  const inputWavPath = path.join(assetsDir, 'test.wav');
  const outputMp3Path = path.join(assetsDir, 'test_converted.mp3');

  beforeAll(() => {
    if(!fs.existsSync(inputWavPath)) 
      throw new Error(`Test WAV file not found at ${inputWavPath}`);
  });

  afterAll(async () => {
    if(fs.existsSync(outputMp3Path)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      fs.unlinkSync(outputMp3Path);
    }
  });

  test('converts WAV to MP3 successfully', async () => {
    await convertWavToMp3(inputWavPath, outputMp3Path);

    expect(fs.existsSync(outputMp3Path)).toBe(true);
    const stats = fs.statSync(outputMp3Path);
    expect(stats.size).toBeGreaterThan(0);
  }, 10000);

  test('throws an error if the input WAV file does not exist', async () => {
    const invalidWavPath = path.join(assetsDir, 'nonexistent.wav');

    await expect(convertWavToMp3(invalidWavPath, outputMp3Path)).rejects.toThrow(
      'FFmpeg conversion failed'
    );
  }, 10000);
});
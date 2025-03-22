const fs = require('fs');
const path = require('path');
const { convertOggToMp3 } = require('../src/utils/utils');

describe('convertOggToMp3', () => {
  const assetsDir = path.join(__dirname, 'assets');
  const inputOggPath = path.join(assetsDir, 'test.ogg');
  const outputMp3Path = path.join(assetsDir, 'test_converted.mp3');

  beforeAll(() => {
    if(!fs.existsSync(inputOggPath)) 
      throw new Error(`Test OGG file not found at ${inputOggPath}`);
  });

  afterAll(async () => {
    if(fs.existsSync(outputMp3Path)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      fs.unlinkSync(outputMp3Path);
    }
  });

  test('converts OGG to MP3 successfully', async () => {
    await convertOggToMp3(inputOggPath, outputMp3Path);

    expect(fs.existsSync(outputMp3Path)).toBe(true);
    const stats = fs.statSync(outputMp3Path);
    expect(stats.size).toBeGreaterThan(0);
  }, 10000);

  test('throws an error if the input OGG file does not exist', async () => {
    const invalidOggPath = path.join(assetsDir, 'nonexistent.ogg');

    await expect(convertOggToMp3(invalidOggPath, outputMp3Path)).rejects.toThrow(
      'FFmpeg conversion failed'
    );
  }, 10000);
});
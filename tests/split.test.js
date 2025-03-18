const fs = require('fs');
const path = require('path');
const { splitAudioFile } = require('../src/utils/utils.js');

describe('splitAudioFile', () => {
  const testDir = path.join(__dirname, 'test-files');
  const mp3Path = path.join(testDir, 'test.mp3');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
    fs.writeFileSync(mp3Path, '');
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  test('splits a file into smaller parts', async () => {
    const parts = await splitAudioFile(mp3Path, 1);
    expect(parts.length).toBeGreaterThan(0);
    parts.forEach(part => {
      expect(fs.existsSync(part)).toBe(true);
    });
  });

  test('throws an error for invalid file path', async () => {
    await expect(splitAudioFile('invalid/path.mp3', 1)).rejects.toThrow();
  });
});
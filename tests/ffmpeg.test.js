const fs = require('fs');
const ffmpeg = require('ffmpeg-static');

describe('ffmpeg-static', () => {
  it('should have FFmpeg installed', () => {
    expect(ffmpeg).toBeDefined();
    expect(typeof ffmpeg).toBe('string');
    expect(fs.existsSync(ffmpeg)).toBe(true);
  });
});

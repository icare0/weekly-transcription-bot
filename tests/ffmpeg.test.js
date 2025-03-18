const ffmpeg = require('ffmpeg-static');
const { exec } = require('child_process');

describe('FFmpeg (ffmpeg-static)', () => {
  test('ffmpeg-static binary is available and working', (done) => {
    // Check if the ffmpeg-static binary path is valid
    expect(ffmpeg).toBeTruthy();
    expect(typeof ffmpeg).toBe('string');

    // Test if the binary is executable
    exec(`${ffmpeg} -version`, (error, stdout, stderr) => {
      if (error) {
        done(`ffmpeg-static binary is not working: ${error.message}`);
      } else {
        expect(stdout).toContain('ffmpeg version'); // Check if FFmpeg version is printed
        done();
      }
    });
  });
});
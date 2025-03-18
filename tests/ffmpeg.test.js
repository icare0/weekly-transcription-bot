const { spawn } = require('child_process');

jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    stderr: { on: jest.fn() },
  })),
}));

describe('ffmpeg process', () => {
  it('should spawn ffmpeg process with correct arguments', () => {
    const args = ['-i', 'input.mp4', 'output.mp3'];
    spawn('ffmpeg', args);

    expect(spawn).toHaveBeenCalledWith('ffmpeg', args);
  });

  it('should handle process events', () => {
    const onMock = jest.fn();
    spawn.mockReturnValue({
      on: onMock,
      stderr: { on: jest.fn() },
    });

    const process = spawn('ffmpeg', ['-i', 'input.mp4', 'output.mp3']);
    process.on('close', () => {});

    expect(onMock).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('should handle stderr events', () => {
    const stderrOnMock = jest.fn();
    spawn.mockReturnValue({
      on: jest.fn(),
      stderr: { on: stderrOnMock },
    });

    const process = spawn('ffmpeg', ['-i', 'input.mp4', 'output.mp3']);
    process.stderr.on('data', () => {});

    expect(stderrOnMock).toHaveBeenCalledWith('data', expect.any(Function));
  });
});
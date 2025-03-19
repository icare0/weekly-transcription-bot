const { Mixer, Input } = require('audio-mixer');

describe('audio-mixer', () => {
  it('should mix multiple audio streams', () => {
    const mixer = new Mixer({
      channels: 1,
      bitDepth: 16,
      sampleRate: 48000,
      clearInterval: 20,
    });

    const input1 = new Input({
      channels: 1,
      bitDepth: 16,
      sampleRate: 48000,
      volume: 1.0,
    });

    const input2 = new Input({
      channels: 1,
      bitDepth: 16,
      sampleRate: 48000,
      volume: 1.0,
    });

    mixer.addInput(input1);
    mixer.addInput(input2);

    expect(mixer.inputs.length).toBe(2);

    mixer.destroy();
  });
});
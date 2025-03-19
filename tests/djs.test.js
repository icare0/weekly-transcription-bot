const { joinVoiceChannel } = require('@discordjs/voice');

describe('Discord.js Integration', () => {
  it('should join a voice channel', async () => {
    const mockGuild = {
      id: '12345',
      voiceAdapterCreator: jest.fn(() => ({
        sendPayload: jest.fn(),
        destroy: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        removeListener: jest.fn(),
      })),
    };
    const mockChannel = { id: '67890', guild: mockGuild };

    const connection = joinVoiceChannel({
      channelId: mockChannel.id,
      guildId: mockGuild.id,
      adapterCreator: mockGuild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

    expect(connection).toBeDefined();
    connection.destroy();
  });
});

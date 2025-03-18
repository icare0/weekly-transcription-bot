const { sendLongMessageToThread } = require('../src/utils/utils.js');

describe('sendLongMessageToThread', () => {
  test('sends a long message in chunks', async () => {
    const mockThread = {
      send: jest.fn().mockResolvedValue({}),
    };

    const longMessage = 'a'.repeat(3000); // 3000-character message
    await sendLongMessageToThread(mockThread, longMessage);

    expect(mockThread.send).toHaveBeenCalledTimes(2); // Should split into 2 chunks
  });
});
const { sendLongMessageToThread } = require('../src/utils/utils.js');

describe('sendLongMessageToThread', () => {
  test('sends a long message in chunks', async () => {
    const mockThread = {
      send: jest.fn().mockResolvedValue({}),
    };

    const longMessage = 'a'.repeat(3000);
    await sendLongMessageToThread(mockThread, longMessage);

    expect(mockThread.send).toHaveBeenCalledTimes(2);
  });
});
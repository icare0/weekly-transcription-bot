const { waitForDrain } = require('../src/utils/utils.js');

describe('waitForDrain', () => {
  test('resolves when the stream drains', async () => {
    const mockStream = {
      writableLength: 100,
      once: jest.fn((event, callback) => {
        if (event === 'drain') {
          mockStream.writableLength = 0;
          callback();
        }
      }),
    };

    await waitForDrain(mockStream);
    expect(mockStream.once).toHaveBeenCalledWith('drain', expect.any(Function));
  });

  test('resolves immediately if the stream is already drained', async () => {
    const mockStream = {
      writableLength: 0,
      once: jest.fn(),
    };

    await waitForDrain(mockStream);
    expect(mockStream.once).not.toHaveBeenCalled();
  });
});

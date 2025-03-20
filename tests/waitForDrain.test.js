const { waitForDrain } = require("../src/utils/utils.js");

test('waitForDrain resolves when the stream drains', async () => {
  const mockStream = {
    writableLength: 10000,
    once: jest.fn((event, callback) => {
      if(event === 'drain') {
        setTimeout(() => {
          mockStream.writableLength = 0;
          callback();
        }, 100);
      }
    }),
  };

  await expect(waitForDrain(mockStream)).resolves.toBeUndefined();

  expect(mockStream.once).toHaveBeenCalledWith('drain', expect.any(Function));
});

test('waitForDrain handles already drained stream', async () => {
  const mockStream = {
    writableLength: 0,
    once: jest.fn(),
  };

  await expect(waitForDrain(mockStream)).resolves.toBeUndefined();

  expect(mockStream.once).not.toHaveBeenCalled();
});
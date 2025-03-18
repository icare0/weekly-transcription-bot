const fs = require('fs');
const path = require('path');
const { transcribe } = require('../src/utils/utils.js');
const OpenAI = require('openai');

jest.mock('openai');
jest.mock('fs');

describe('transcribe', () => {
  const testDir = path.join(__dirname, 'test_files');
  const mp3Path = path.join(testDir, 'test.mp3');

  beforeAll(() => {
    fs.createReadStream.mockImplementation((filePath) => {
      if (filePath === mp3Path) {
        return {
          on: jest.fn((event, callback) => {
            if (event === 'open') callback();
          }),
        };
      }
      throw new Error('File not found');
    });
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  test('transcribes a single audio file', async () => {
    const mockTranscription = { text: 'This is a test transcription.' };
    OpenAI.mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: jest.fn().mockResolvedValue(mockTranscription),
        },
      },
    }));

    const result = await transcribe([mp3Path]);
    expect(result).toBe(mockTranscription.text);
  });

  test('returns null if transcription fails', async () => {
    OpenAI.mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: jest.fn().mockRejectedValue(new Error('Transcription failed')),
        },
      },
    }));

    const result = await transcribe([mp3Path]);
    expect(result).toBeNull();
  });
});
const fs = require('fs');
const path = require('path');
const { summarizeTranscription } = require('../src/utils/utils.js');
const OpenAI = require('openai');

jest.mock('openai');

describe('summarizeTranscription', () => {
  const testDir = path.join(__dirname, 'test-files');
  const transcriptionPath = path.join(testDir, 'transcription.txt');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
    fs.writeFileSync(transcriptionPath, 'This is a test transcription.');
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  test('summarizes a transcription', async () => {
    const mockSummary = 'This is a test summary.';
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: mockSummary } }],
          }),
        },
      },
    }));

    const result = await summarizeTranscription(transcriptionPath);
    expect(result).toBe(mockSummary);
  });

  test('returns null if summarization fails', async () => {
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('Summarization failed')),
        },
      },
    }));

    const result = await summarizeTranscription(transcriptionPath);
    expect(result).toBeNull();
  });
});
import { afterEach, beforeEach, vi } from "vitest";

import { mockGeminiNoMatch } from "./tests/__helpers__/geminiMocks";

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => {
    const mockGlobal = globalThis as {
      __geminiGenerateContentMock?: ReturnType<typeof vi.fn>;
    };
    const generateContentMock =
      mockGlobal.__geminiGenerateContentMock ?? vi.fn();
    mockGlobal.__geminiGenerateContentMock = generateContentMock;

    return {
      models: {
        generateContent: generateContentMock,
      },
    };
  }),
}));

const originalConsoleError = console.error.bind(console);
const SUPPRESSED_GEMINI_LOG_PATTERNS = [
  /Missing GEMINI_API_KEY/i,
  /GoogleGenAI request failed/i,
];

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-gemini-api-key";
  vi.clearAllMocks();
  mockGeminiNoMatch();
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
  const shouldSuppress = args.some((arg) => {
    if (typeof arg !== "string") {
      return false;
    }

    return SUPPRESSED_GEMINI_LOG_PATTERNS.some((pattern) => pattern.test(arg));
  });

  if (!shouldSuppress) {
    originalConsoleError(...args);
  }
});

import { vi } from "vitest";

const DEFAULT_PLANNER_RESPONSE = JSON.stringify({
  intentGraph: [
    {
      intent: "ADD",
      targets: [
        {
          raw: "burrata salad",
          resolvedId: "burrata-salad",
          label: "Burrata & Orchard Tomatoes",
          confidence: 0.99,
          quantity: 2,
          modifiers: [],
        },
      ],
    },
  ],
  confirmation: "Added 2 burrata salads.",
});

const DEFAULT_CLARIFICATION_RESPONSE = JSON.stringify({
  actions: [],
  confirmation: "Could you clarify which item you meant?",
  executionLog: [
    "PROCESSING_INTENT...",
    "VALIDATING_MENU...",
    "AWAITING_CLARIFICATION...",
    "AWAITING_INPUT...",
  ],
  clarificationRequired: true,
  suggestions: [
    {
      id: "burrata-salad",
      name: "Burrata & Orchard Tomatoes",
      tags: ["starter"],
      dietary: ["vegetarian"],
    },
  ],
});

const DEFAULT_NO_MATCH_RESPONSE = JSON.stringify({
  actions: [],
  confirmation: "I couldn't find that item on our current menu.",
  executionLog: [
    "PROCESSING_INTENT...",
    "VALIDATING_MENU...",
    "NO_MATCH_FOUND",
    "AWAITING_INPUT...",
  ],
  clarificationRequired: false,
  suggestions: [],
});

type GenerateContentResult = { text: string | null };
type GenerateContentMock = ReturnType<
  typeof vi.fn<[], Promise<GenerateContentResult>>
>;

function getGenerateContentMock(): GenerateContentMock {
  const mockGlobal = globalThis as {
    __geminiGenerateContentMock?: GenerateContentMock;
  };

  if (!mockGlobal.__geminiGenerateContentMock) {
    mockGlobal.__geminiGenerateContentMock = vi.fn();
  }

  return mockGlobal.__geminiGenerateContentMock;
}

function installGeminiMock() {
  const mock = getGenerateContentMock();
  mock.mockReset();
  return mock;
}

export function mockGeminiSuccess(responseText = DEFAULT_PLANNER_RESPONSE) {
  const mock = installGeminiMock();
  mock.mockResolvedValue({ text: responseText });
  return mock;
}

export function mockGeminiClarification() {
  const mock = installGeminiMock();
  mock.mockResolvedValue({ text: DEFAULT_CLARIFICATION_RESPONSE });
  return mock;
}

export function mockGeminiNoMatch() {
  const mock = installGeminiMock();
  mock.mockResolvedValue({ text: DEFAULT_NO_MATCH_RESPONSE });
  return mock;
}

export function mockGeminiFailure(error = new Error("Gemini API down")) {
  const mock = installGeminiMock();
  mock.mockRejectedValue(error);
  return mock;
}

export function geminiMockResponses() {
  return {
    planner: DEFAULT_PLANNER_RESPONSE,
    clarification: DEFAULT_CLARIFICATION_RESPONSE,
    noMatch: DEFAULT_NO_MATCH_RESPONSE,
  };
}

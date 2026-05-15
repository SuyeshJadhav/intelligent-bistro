/**
 * gemini.lib.test.ts - Unit tests for the Gemini wrapper library
 *
 * Tests:
 * - Zod schema validation (cartActionSchema, aiResponseSchema)
 * - stripMarkdownFences utility behavior
 * - processOrder: valid response parsing
 * - processOrder: fallback on malformed JSON
 * - processOrder: fallback when Gemini API throws
 * - Schema rejects invalid action types, wrong quantities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MenuItem } from "../src/data/menu";
import { processOrder } from "../src/lib/gemini";

import {
  mockGeminiClarification,
  mockGeminiFailure,
  mockGeminiNoMatch,
  mockGeminiSuccess,
} from "../tests/__helpers__/geminiMocks";

vi.mock("@google/genai", () => {
  const generateContentMock = vi.fn();
  (
    globalThis as { __geminiGenerateContentMock?: typeof generateContentMock }
  ).__geminiGenerateContentMock = generateContentMock;

  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: generateContentMock,
      },
    })),
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────

const TEST_MENU: MenuItem[] = [
  {
    id: "burrata-salad",
    name: "Burrata & Orchard Tomatoes",
    description: "Creamy burrata.",
    price: 14,
    category: "Starters",
  },
  {
    id: "tagliatelle",
    name: "Black Pepper Tagliatelle",
    description: "Fresh pasta.",
    price: 24,
    category: "Mains",
  },
];

const VALID_AI_JSON = JSON.stringify({
  actions: [{ type: "ADD_ITEM", itemId: "burrata-salad", quantity: 2 }],
  confirmation: "Added 2 burrata salads.",
  executionLog: [
    "PROCESSING_INTENT...",
    "VALIDATING_MENU...",
    "UPDATING_STATE...",
    "SYNC_COMPLETE",
  ],
});

const FALLBACK_RESPONSE = {
  actions: [],
  confirmation:
    "I couldn't process that order just now. Please try again with item names from our menu.",
  executionLog: [
    "PROCESSING_INTENT...",
    "VALIDATING_MENU...",
    "NO_MATCH_FOUND",
    "AWAITING_INPUT...",
  ],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("gemini.lib", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-api-key";
    mockGeminiSuccess();
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  // ── processOrder: happy path ───────────────────────────────────────────────

  describe("processOrder — happy path", () => {
    it("should parse valid JSON response from Gemini", async () => {
      mockGeminiSuccess(VALID_AI_JSON);

      const result = await processOrder("Add 2 burratas", [], TEST_MENU);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("ADD_ITEM");
      expect(result.actions[0].itemId).toBe("burrata-salad");
      expect((result.actions[0] as any).quantity).toBe(2);
      expect(result.executionLog).toHaveLength(4);
    });

    it("should strip markdown code fences before parsing", async () => {
      const fencedJson = "```json\n" + VALID_AI_JSON + "\n```";
      mockGeminiSuccess(fencedJson);

      const result = await processOrder("Add 2 burratas", [], TEST_MENU);
      expect(result.actions).toHaveLength(1);
    });

    it("should strip plain code fences (no language tag) before parsing", async () => {
      const fencedJson = "```\n" + VALID_AI_JSON + "\n```";
      mockGeminiSuccess(fencedJson);

      const result = await processOrder("Add 2 burratas", [], TEST_MENU);
      expect(result.actions).toHaveLength(1);
    });

    it("should handle response with empty actions array", async () => {
      const emptyActionsJson = JSON.stringify({
        actions: [],
        confirmation: "Nothing to add.",
        executionLog: [
          "PROCESSING_INTENT...",
          "VALIDATING_MENU...",
          "NO_MATCH_FOUND",
          "AWAITING_INPUT...",
        ],
      });
      mockGeminiSuccess(emptyActionsJson);

      const result = await processOrder("unknown request", [], TEST_MENU);
      expect(result.actions).toEqual([]);
    });

    it("should handle multiple action types in a single response", async () => {
      const multiActionJson = JSON.stringify({
        actions: [
          { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
          { type: "REMOVE_ITEM", itemId: "tagliatelle" },
          { type: "UPDATE_QUANTITY", itemId: "burrata-salad", quantity: 3 },
        ],
        confirmation: "Multiple actions applied.",
        executionLog: [
          "PROCESSING_INTENT...",
          "VALIDATING_MENU...",
          "UPDATING_STATE...",
          "SYNC_COMPLETE",
        ],
      });
      mockGeminiSuccess(multiActionJson);

      const result = await processOrder("Complex order", [], TEST_MENU);
      expect(result.actions).toHaveLength(3);
    });
  });

  // ── processOrder: fallback handling ──────────────────────────────────────

  describe("processOrder — fallback responses", () => {
    it("should return fallback when Gemini returns invalid JSON", async () => {
      mockGeminiSuccess("{ this is definitely not JSON }");

      const result = await processOrder("Order something", [], TEST_MENU);
      expect(result).toMatchObject(FALLBACK_RESPONSE);
    });

    it("should return fallback when Gemini returns empty string", async () => {
      mockGeminiSuccess("");

      const result = await processOrder("Order something", [], TEST_MENU);
      expect(result).toMatchObject(FALLBACK_RESPONSE);
    });

    it("should return fallback when Zod validation fails (wrong executionLog length)", async () => {
      const invalidJson = JSON.stringify({
        actions: [],
        confirmation: "Done",
        executionLog: ["only one"], // should be 4
      });
      mockGeminiSuccess(invalidJson);

      const result = await processOrder("Order something", [], TEST_MENU);
      expect(result).toMatchObject(FALLBACK_RESPONSE);
    });

    it("should return fallback when Gemini API throws", async () => {
      mockGeminiFailure(new Error("Gemini API down"));

      const result = await processOrder("Order something", [], TEST_MENU);
      expect(result).toMatchObject(FALLBACK_RESPONSE);
    });

    it("should preserve a Gemini no-match payload", async () => {
      mockGeminiNoMatch();

      const result = await processOrder("Order something", [], TEST_MENU);
      expect(result.confirmation).toContain("couldn't find");
      expect(result.actions).toEqual([]);
    });

    it("should return fallback when Gemini returns null text", async () => {
      mockGeminiSuccess(JSON.stringify({}));

      const result = await processOrder("Order something", [], TEST_MENU);
      expect(result).toMatchObject(FALLBACK_RESPONSE);
    });
  });

  describe("processOrder — clarification and no-match helpers", () => {
    it("should preserve a clarification response from Gemini", async () => {
      mockGeminiClarification();

      const result = await processOrder("Need help", [], TEST_MENU);
      expect(result.clarificationRequired).toBe(true);
      expect(result.suggestions).toHaveLength(1);
    });
  });

  // ── Zod schema validation ──────────────────────────────────────────────────

  describe("Zod schema validation", () => {
    // We test the schemas indirectly through processOrder

    it("should reject ADD_ITEM with quantity = 0 (Zod: positive)", async () => {
      mockGeminiSuccess(
        JSON.stringify({
          actions: [{ type: "ADD_ITEM", itemId: "burrata-salad", quantity: 0 }],
          confirmation: "ok",
          executionLog: [
            "PROCESSING_INTENT...",
            "VALIDATING_MENU...",
            "UPDATING_STATE...",
            "SYNC_COMPLETE",
          ],
        }),
      );

      // Zod will fail → fallback
      const result = await processOrder("Add 0", [], TEST_MENU);
      expect(result).toMatchObject(FALLBACK_RESPONSE);
    });

    it("should reject ADD_ITEM with negative quantity (Zod: positive)", async () => {
      mockGeminiSuccess(
        JSON.stringify({
          actions: [
            { type: "ADD_ITEM", itemId: "burrata-salad", quantity: -5 },
          ],
          confirmation: "ok",
          executionLog: [
            "PROCESSING_INTENT...",
            "VALIDATING_MENU...",
            "UPDATING_STATE...",
            "SYNC_COMPLETE",
          ],
        }),
      );

      const result = await processOrder("Add -5", [], TEST_MENU);
      expect(result).toMatchObject(FALLBACK_RESPONSE);
    });

    it("should reject UPDATE_QUANTITY with negative quantity (Zod: nonnegative)", async () => {
      mockGeminiSuccess(
        JSON.stringify({
          actions: [
            {
              type: "UPDATE_QUANTITY",
              itemId: "burrata-salad",
              quantity: -1,
            },
          ],
          confirmation: "ok",
          executionLog: [
            "PROCESSING_INTENT...",
            "VALIDATING_MENU...",
            "UPDATING_STATE...",
            "SYNC_COMPLETE",
          ],
        }),
      );

      const result = await processOrder("Update to -1", [], TEST_MENU);
      expect(result).toMatchObject(FALLBACK_RESPONSE);
    });

    it("should accept UPDATE_QUANTITY with quantity = 0 (Zod: nonnegative)", async () => {
      mockGeminiSuccess(
        JSON.stringify({
          actions: [
            {
              type: "UPDATE_QUANTITY",
              itemId: "burrata-salad",
              quantity: 0,
            },
          ],
          confirmation: "Updated to 0.",
          executionLog: [
            "PROCESSING_INTENT...",
            "VALIDATING_MENU...",
            "UPDATING_STATE...",
            "SYNC_COMPLETE",
          ],
        }),
      );

      const result = await processOrder("Set to 0", [], TEST_MENU);
      expect(result.actions[0].type).toBe("UPDATE_QUANTITY");
    });

    it("should reject response with missing confirmation field", async () => {
      mockGeminiSuccess(
        JSON.stringify({
          actions: [],
          // confirmation missing
          executionLog: [
            "PROCESSING_INTENT...",
            "VALIDATING_MENU...",
            "UPDATING_STATE...",
            "SYNC_COMPLETE",
          ],
        }),
      );

      const result = await processOrder("test", [], TEST_MENU);
      expect(result).toMatchObject(FALLBACK_RESPONSE);
    });

    it("should reject response with fractional quantity (Zod: int)", async () => {
      mockGeminiSuccess(
        JSON.stringify({
          actions: [
            { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1.5 },
          ],
          confirmation: "ok",
          executionLog: [
            "PROCESSING_INTENT...",
            "VALIDATING_MENU...",
            "UPDATING_STATE...",
            "SYNC_COMPLETE",
          ],
        }),
      );

      const result = await processOrder("Add 1.5", [], TEST_MENU);
      expect(result).toMatchObject(FALLBACK_RESPONSE);
    });
  });
});

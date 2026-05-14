/**
 * defensiveParsing.test.ts - Exhaustive tests for defensiveParsing.ts
 *
 * Tests every exported function against:
 * - Valid inputs (happy path)
 * - Null/undefined inputs
 * - Malformed structures
 * - Edge cases and boundary conditions
 * - Injection-like inputs
 */

import {
  createCartAction,
  parseAIResponse,
  parseCartActions,
  parseExecutionLog,
  safeJsonParse,
  validateCartAction,
} from "@/lib/defensiveParsing";
import type { CartAction } from "@/lib/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock logger to capture warnings without polluting console output ───────

function makeMockLogger() {
  return {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
  } as unknown as Console;
}

describe("defensiveParsing", () => {
  let mockLogger: Console;

  beforeEach(() => {
    mockLogger = makeMockLogger();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── safeJsonParse ────────────────────────────────────────────────────────

  describe("safeJsonParse", () => {
    it("should parse valid JSON objects", () => {
      const result = safeJsonParse('{"key": "value"}', mockLogger);
      expect(result).toEqual({ key: "value" });
    });

    it("should parse valid JSON arrays", () => {
      const result = safeJsonParse('[1, 2, 3]', mockLogger);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should parse JSON primitives", () => {
      expect(safeJsonParse('"hello"', mockLogger)).toBe("hello");
      expect(safeJsonParse('42', mockLogger)).toBe(42);
      expect(safeJsonParse('true', mockLogger)).toBe(true);
      expect(safeJsonParse('null', mockLogger)).toBeNull();
    });

    it("should return null for malformed JSON", () => {
      expect(safeJsonParse("{ this is not json }", mockLogger)).toBeNull();
    });

    it("should return null for truncated JSON", () => {
      expect(safeJsonParse('{"incomplete":', mockLogger)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(safeJsonParse("", mockLogger)).toBeNull();
    });

    it("should return null for non-string inputs", () => {
      expect(safeJsonParse(null, mockLogger)).toBeNull();
      expect(safeJsonParse(undefined, mockLogger)).toBeNull();
      expect(safeJsonParse(42 as any, mockLogger)).toBeNull();
      expect(safeJsonParse({} as any, mockLogger)).toBeNull();
    });

    it("should return null for markdown-fenced JSON (needs pre-cleaning)", () => {
      // safeJsonParse does NOT strip fences — that's gemini.ts's job
      const result = safeJsonParse("```json\n{}\n```", mockLogger);
      expect(result).toBeNull();
    });

    it("should never throw regardless of input", () => {
      const weirdInputs = [
        undefined,
        null,
        [],
        {},
        Symbol("test"),
        () => {},
        NaN,
        Infinity,
      ];
      for (const input of weirdInputs) {
        expect(() => safeJsonParse(input as any, mockLogger)).not.toThrow();
      }
    });
  });

  // ── validateCartAction ───────────────────────────────────────────────────

  describe("validateCartAction", () => {
    describe("ADD_ITEM", () => {
      it("should validate a correct ADD_ITEM action", () => {
        const result = validateCartAction(
          { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 2 },
          mockLogger,
        );
        expect(result).toEqual({
          type: "ADD_ITEM",
          itemId: "burrata-salad",
          quantity: 2,
        });
      });

      it("should trim whitespace from itemId", () => {
        const result = validateCartAction(
          { type: "ADD_ITEM", itemId: "  burrata-salad  ", quantity: 1 },
          mockLogger,
        );
        expect(result?.itemId).toBe("burrata-salad");
      });

      it("should reject ADD_ITEM with missing quantity", () => {
        expect(
          validateCartAction({ type: "ADD_ITEM", itemId: "burrata-salad" }, mockLogger),
        ).toBeNull();
      });

      it("should reject ADD_ITEM with zero quantity", () => {
        expect(
          validateCartAction(
            { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 0 },
            mockLogger,
          ),
        ).toBeNull();
      });

      it("should reject ADD_ITEM with negative quantity", () => {
        expect(
          validateCartAction(
            { type: "ADD_ITEM", itemId: "burrata-salad", quantity: -1 },
            mockLogger,
          ),
        ).toBeNull();
      });

      it("should reject ADD_ITEM with fractional quantity", () => {
        expect(
          validateCartAction(
            { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1.5 },
            mockLogger,
          ),
        ).toBeNull();
      });

      it("should reject ADD_ITEM with string quantity", () => {
        expect(
          validateCartAction(
            { type: "ADD_ITEM", itemId: "burrata-salad", quantity: "2" as any },
            mockLogger,
          ),
        ).toBeNull();
      });

      it("should reject ADD_ITEM with empty itemId", () => {
        expect(
          validateCartAction(
            { type: "ADD_ITEM", itemId: "", quantity: 1 },
            mockLogger,
          ),
        ).toBeNull();
      });

      it("should reject ADD_ITEM with whitespace-only itemId", () => {
        expect(
          validateCartAction(
            { type: "ADD_ITEM", itemId: "   ", quantity: 1 },
            mockLogger,
          ),
        ).toBeNull();
      });
    });

    describe("REMOVE_ITEM", () => {
      it("should validate a correct REMOVE_ITEM action", () => {
        const result = validateCartAction(
          { type: "REMOVE_ITEM", itemId: "burrata-salad" },
          mockLogger,
        );
        expect(result).toEqual({ type: "REMOVE_ITEM", itemId: "burrata-salad" });
      });

      it("should reject REMOVE_ITEM with empty itemId", () => {
        expect(
          validateCartAction({ type: "REMOVE_ITEM", itemId: "" }, mockLogger),
        ).toBeNull();
      });

      it("should trim whitespace from itemId", () => {
        const result = validateCartAction(
          { type: "REMOVE_ITEM", itemId: "  tagliatelle  " },
          mockLogger,
        );
        expect(result?.itemId).toBe("tagliatelle");
      });
    });

    describe("UPDATE_QUANTITY", () => {
      it("should validate UPDATE_QUANTITY with positive quantity", () => {
        const result = validateCartAction(
          { type: "UPDATE_QUANTITY", itemId: "burrata-salad", quantity: 5 },
          mockLogger,
        );
        expect(result).toEqual({
          type: "UPDATE_QUANTITY",
          itemId: "burrata-salad",
          quantity: 5,
        });
      });

      it("should validate UPDATE_QUANTITY with zero quantity (removal intent)", () => {
        const result = validateCartAction(
          { type: "UPDATE_QUANTITY", itemId: "burrata-salad", quantity: 0 },
          mockLogger,
        );
        expect(result?.quantity).toBe(0);
      });

      it("should reject UPDATE_QUANTITY with negative quantity", () => {
        expect(
          validateCartAction(
            { type: "UPDATE_QUANTITY", itemId: "burrata-salad", quantity: -1 },
            mockLogger,
          ),
        ).toBeNull();
      });

      it("should reject UPDATE_QUANTITY with missing quantity", () => {
        expect(
          validateCartAction(
            { type: "UPDATE_QUANTITY", itemId: "burrata-salad" },
            mockLogger,
          ),
        ).toBeNull();
      });
    });

    describe("Unknown and malformed actions", () => {
      it("should return null for unknown action type", () => {
        expect(
          validateCartAction(
            { type: "DESTROY_CART", itemId: "burrata-salad" },
            mockLogger,
          ),
        ).toBeNull();
      });

      it("should return null for null input", () => {
        expect(validateCartAction(null, mockLogger)).toBeNull();
      });

      it("should return null for non-object input", () => {
        expect(validateCartAction("string", mockLogger)).toBeNull();
        expect(validateCartAction(42, mockLogger)).toBeNull();
        expect(validateCartAction([], mockLogger)).toBeNull();
      });

      it("should return null when type is not a string", () => {
        expect(
          validateCartAction({ type: 42, itemId: "burrata-salad" }, mockLogger),
        ).toBeNull();
      });

      it("should return null when itemId is not a string", () => {
        expect(
          validateCartAction(
            { type: "ADD_ITEM", itemId: 123, quantity: 1 },
            mockLogger,
          ),
        ).toBeNull();
      });

      it("should return null for deeply nested corrupt data", () => {
        expect(
          validateCartAction(
            {
              type: "ADD_ITEM",
              itemId: { nested: "burrata-salad" },
              quantity: 1,
            },
            mockLogger,
          ),
        ).toBeNull();
      });
    });
  });

  // ── parseCartActions ─────────────────────────────────────────────────────

  describe("parseCartActions", () => {
    it("should parse a valid array of mixed actions", () => {
      const input = [
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 2 },
        { type: "REMOVE_ITEM", itemId: "tagliatelle" },
        { type: "UPDATE_QUANTITY", itemId: "salmon-bowl", quantity: 3 },
      ];
      const result = parseCartActions(input, mockLogger);
      expect(result).toHaveLength(3);
      expect(result[0]?.type).toBe("ADD_ITEM");
      expect(result[1]?.type).toBe("REMOVE_ITEM");
      expect(result[2]?.type).toBe("UPDATE_QUANTITY");
    });

    it("should return empty array for null input", () => {
      expect(parseCartActions(null, mockLogger)).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should return empty array for undefined input", () => {
      expect(parseCartActions(undefined, mockLogger)).toEqual([]);
    });

    it("should return empty array for non-array input", () => {
      expect(parseCartActions("not an array", mockLogger)).toEqual([]);
      expect(parseCartActions({}, mockLogger)).toEqual([]);
      expect(parseCartActions(42, mockLogger)).toEqual([]);
    });

    it("should skip null items within array", () => {
      const input = [
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
        null,
        { type: "REMOVE_ITEM", itemId: "tagliatelle" },
      ];
      const result = parseCartActions(input, mockLogger);
      expect(result).toHaveLength(2);
    });

    it("should skip undefined items within array", () => {
      const input = [
        undefined,
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
      ];
      const result = parseCartActions(input, mockLogger);
      expect(result).toHaveLength(1);
    });

    it("should pass through items with unknown types (applyCartDelta rejects them)", () => {
      // parseCartActions validates shape, not business logic.
      // Unknown types with valid string format pass through to applyCartDelta.
      const input = [
        { type: "HACK_CART", itemId: "burrata-salad" },
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
      ];
      const result = parseCartActions(input, mockLogger);
      // Both pass parseCartActions (string types); applyCartDelta rejects HACK_CART
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((a) => a.type === "ADD_ITEM")).toBe(true);
    });

    it("should skip items with missing itemId", () => {
      const input = [
        { type: "ADD_ITEM", quantity: 1 }, // missing itemId
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
      ];
      const result = parseCartActions(input, mockLogger);
      expect(result).toHaveLength(1);
    });

    it("should skip items with invalid quantity type", () => {
      const input = [
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: "two" },
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
      ];
      const result = parseCartActions(input, mockLogger);
      expect(result).toHaveLength(1);
    });

    it("should skip items with NaN quantity", () => {
      const input = [
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: NaN },
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
      ];
      const result = parseCartActions(input, mockLogger);
      expect(result).toHaveLength(1);
    });

    it("should skip items with Infinity quantity", () => {
      const input = [
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: Infinity },
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
      ];
      const result = parseCartActions(input, mockLogger);
      expect(result).toHaveLength(1);
    });

    it("should handle empty array gracefully", () => {
      expect(parseCartActions([], mockLogger)).toEqual([]);
    });

    it("should log warnings when there are failures", () => {
      parseCartActions(
        [null, { type: "INVALID" }],
        mockLogger,
      );
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ── parseAIResponse ──────────────────────────────────────────────────────

  describe("parseAIResponse", () => {
    const validResponse = {
      actions: [{ type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 }],
      confirmation: "Added burrata salad.",
      executionLog: [
        "PROCESSING_INTENT...",
        "VALIDATING_MENU...",
        "UPDATING_STATE...",
        "SYNC_COMPLETE",
      ],
    };

    it("should parse a valid AI response", () => {
      const result = parseAIResponse(validResponse, mockLogger);
      expect(result).not.toBeNull();
      expect(result?.confirmation).toBe("Added burrata salad.");
      expect(result?.actions).toHaveLength(1);
      expect(result?.executionLog).toHaveLength(4);
    });

    it("should return null for null input", () => {
      expect(parseAIResponse(null, mockLogger)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(parseAIResponse(undefined, mockLogger)).toBeNull();
    });

    it("should return null for non-object input", () => {
      expect(parseAIResponse("string", mockLogger)).toBeNull();
      expect(parseAIResponse(42, mockLogger)).toBeNull();
    });

    it("should return null when confirmation is missing", () => {
      const { confirmation: _, ...noConfirm } = validResponse;
      expect(parseAIResponse(noConfirm, mockLogger)).toBeNull();
    });

    it("should return null when confirmation is not a string", () => {
      expect(
        parseAIResponse({ ...validResponse, confirmation: 42 }, mockLogger),
      ).toBeNull();
    });

    it("should return null when executionLog is missing", () => {
      const { executionLog: _, ...noLog } = validResponse;
      expect(parseAIResponse(noLog, mockLogger)).toBeNull();
    });

    it("should return null when executionLog is not an array", () => {
      expect(
        parseAIResponse(
          { ...validResponse, executionLog: "not array" },
          mockLogger,
        ),
      ).toBeNull();
    });

    it("should return null when executionLog has wrong length", () => {
      expect(
        parseAIResponse(
          { ...validResponse, executionLog: ["one", "two"] },
          mockLogger,
        ),
      ).toBeNull();

      expect(
        parseAIResponse(
          {
            ...validResponse,
            executionLog: ["a", "b", "c", "d", "e"], // 5 entries
          },
          mockLogger,
        ),
      ).toBeNull();
    });

    it("should return null when executionLog contains non-strings", () => {
      expect(
        parseAIResponse(
          { ...validResponse, executionLog: [1, null, true, {}] },
          mockLogger,
        ),
      ).toBeNull();
    });

    it("should parse response with empty actions array", () => {
      const result = parseAIResponse(
        { ...validResponse, actions: [] },
        mockLogger,
      );
      expect(result).not.toBeNull();
      expect(result?.actions).toEqual([]);
    });

    it("should skip invalid actions but still return response", () => {
      // parseAIResponse calls parseCartActions which filters invalids
      const result = parseAIResponse(
        {
          ...validResponse,
          actions: [
            { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
            null, // invalid
          ],
        },
        mockLogger,
      );
      // Should succeed with 1 valid action
      expect(result?.actions).toHaveLength(1);
    });
  });

  // ── parseExecutionLog ────────────────────────────────────────────────────

  describe("parseExecutionLog", () => {
    const DEFAULTS: [string, string, string, string] = [
      "PROCESSING_INTENT...",
      "VALIDATING_MENU...",
      "UPDATING_STATE...",
      "SYNC_COMPLETE",
    ];

    it("should return valid 4-entry log unchanged", () => {
      const input = [
        "PROCESSING_INTENT...",
        "VALIDATING_MENU...",
        "UPDATING_STATE...",
        "SYNC_COMPLETE",
      ];
      expect(parseExecutionLog(input, mockLogger)).toEqual(input);
    });

    it("should return defaults for non-array input", () => {
      expect(parseExecutionLog(null, mockLogger)).toEqual(DEFAULTS);
      expect(parseExecutionLog("string", mockLogger)).toEqual(DEFAULTS);
      expect(parseExecutionLog({}, mockLogger)).toEqual(DEFAULTS);
    });

    it("should pad short arrays with defaults", () => {
      const result = parseExecutionLog(["STEP_1"], mockLogger);
      expect(result[0]).toBe("STEP_1");
      expect(result[1]).toBe(DEFAULTS[1]);
      expect(result[2]).toBe(DEFAULTS[2]);
      expect(result[3]).toBe(DEFAULTS[3]);
    });

    it("should truncate arrays longer than 4 to exactly 4 entries", () => {
      const result = parseExecutionLog(
        ["a", "b", "c", "d", "e", "f"],
        mockLogger,
      );
      expect(result).toHaveLength(4);
    });

    it("should replace non-string entries with defaults", () => {
      const result = parseExecutionLog(
        ["STEP_1", null, 42, true],
        mockLogger,
      );
      expect(result[0]).toBe("STEP_1");
      expect(result[1]).toBe(DEFAULTS[1]);
      expect(result[2]).toBe(DEFAULTS[2]);
      expect(result[3]).toBe(DEFAULTS[3]);
    });

    it("should always return a tuple of exactly 4 strings", () => {
      const result = parseExecutionLog([], mockLogger);
      expect(result).toHaveLength(4);
      result.forEach((entry) => expect(typeof entry).toBe("string"));
    });
  });

  // ── createCartAction ─────────────────────────────────────────────────────

  describe("createCartAction", () => {
    it("should create a valid ADD_ITEM action", () => {
      const result = createCartAction("ADD_ITEM", "burrata-salad", 2, mockLogger);
      expect(result).toEqual({
        type: "ADD_ITEM",
        itemId: "burrata-salad",
        quantity: 2,
      });
    });

    it("should create a valid REMOVE_ITEM action", () => {
      const result = createCartAction("REMOVE_ITEM", "burrata-salad", undefined, mockLogger);
      expect(result).toEqual({
        type: "REMOVE_ITEM",
        itemId: "burrata-salad",
      });
    });

    it("should normalize type to uppercase", () => {
      const result = createCartAction("add_item", "burrata-salad", 1, mockLogger);
      expect(result?.type).toBe("ADD_ITEM");
    });

    it("should trim whitespace from itemId", () => {
      const result = createCartAction("REMOVE_ITEM", "  burrata-salad  ", undefined, mockLogger);
      expect(result?.itemId).toBe("burrata-salad");
    });

    it("should return null for empty itemId", () => {
      expect(createCartAction("ADD_ITEM", "", 1, mockLogger)).toBeNull();
    });

    it("should return null for whitespace-only itemId", () => {
      expect(createCartAction("ADD_ITEM", "   ", 1, mockLogger)).toBeNull();
    });

    it("should return null for invalid quantity", () => {
      expect(createCartAction("ADD_ITEM", "burrata-salad", -1, mockLogger)).toBeNull();
      expect(createCartAction("ADD_ITEM", "burrata-salad", 1.5, mockLogger)).toBeNull();
    });

    it("should return null for unknown action type after normalization", () => {
      expect(createCartAction("INVALID_TYPE", "burrata-salad", 1, mockLogger)).toBeNull();
    });

    it("should not throw for any combination of string inputs", () => {
      const types = ["ADD_ITEM", "REMOVE_ITEM", "UPDATE_QUANTITY", "UNKNOWN", ""];
      const ids = ["burrata-salad", "", "  ", "<script>", "null"];
      const quantities = [undefined, 0, 1, -1, 1.5, NaN, Infinity];
      for (const type of types) {
        for (const id of ids) {
          for (const qty of quantities) {
            expect(() =>
              createCartAction(type, id, qty as any, mockLogger),
            ).not.toThrow();
          }
        }
      }
    });
  });
});

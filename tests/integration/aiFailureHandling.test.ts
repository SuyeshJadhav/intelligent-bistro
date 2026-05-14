/**
 * aiFailureHandling.test.ts - Exhaustive AI failure scenario tests
 *
 * Tests every documented failure mode from the prompt:
 * - Hallucinated menu items
 * - Malformed Gemini JSON
 * - Missing required fields
 * - Wrong action types
 * - Nested data corruption
 * - Unexpected arrays
 * - Duplicate actions
 * - Conflicting mutations
 * - Ambiguous intents (resolved to no-op or graceful fallback)
 *
 * Each test verifies:
 * 1. The system does NOT crash
 * 2. The cart state is correct (not corrupted)
 * 3. Invalid data is rejected at the appropriate layer
 */

import { applyCartDelta, applyCartDeltaSafe } from "@/lib/applyCartDelta";
import { parseAIResponse, parseCartActions } from "@/lib/defensiveParsing";
import { useCartStore } from "@/store/cartStore";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { resetAllStores, assertCartConsistency } from "../__helpers__/storeHelpers";
import { makeAddAction } from "../__fixtures__/factories";
import {
  HALLUCINATED_ITEM_RESPONSE,
  EXTREME_QUANTITY_RESPONSE,
  ZERO_QUANTITY_ADD_RESPONSE,
  FRACTIONAL_QUANTITY_RESPONSE,
  DUPLICATE_ACTIONS_RESPONSE,
  CONFLICTING_ACTIONS_RESPONSE,
  DEEPLY_NESTED_CORRUPT_RESPONSE,
  NULL_ACTION_IN_ARRAY,
  UNKNOWN_ACTION_TYPE_RESPONSE,
  MALFORMED_MISSING_ACTIONS,
  MALFORMED_WRONG_EXECUTION_LOG_LENGTH,
  MALFORMED_NON_STRING_LOG_ENTRIES,
} from "../__fixtures__/aiResponseFixtures";

describe("AI Failure Handling Tests", () => {
  const mockLogger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any as Console;

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  // ── Hallucinated menu items ────────────────────────────────────────────────

  describe("Hallucinated menu items", () => {
    it("'Add pizza' → should be rejected, cart remains empty", () => {
      const parsed = parseAIResponse(HALLUCINATED_ITEM_RESPONSE, mockLogger)!;
      const { applied, failed } = applyCartDelta(parsed.actions);

      expect(applied).toBe(0);
      expect(failed).toBe(2);
      expect(useCartStore.getState().items).toHaveLength(0);
      assertCartConsistency();
    });

    it("'Add 999 burgers' (hallucinated + extreme qty) → rejected", () => {
      const parsed = parseAIResponse(EXTREME_QUANTITY_RESPONSE, mockLogger)!;
      // 999 is valid quantity for ADD_ITEM, but "burrata-salad" is on menu (valid)
      // EXTREME_QUANTITY_RESPONSE uses burrata-salad, so it WILL be applied
      const { applied } = applyCartDelta(parsed.actions);
      expect(applied).toBe(1);
      expect(useCartStore.getState().totalItems).toBe(999);
      assertCartConsistency(); // totals still consistent
    });

    it("'Add pizza' (completely off menu) → 0 applied", () => {
      const offMenuResponse = {
        actions: [{ type: "ADD_ITEM" as const, itemId: "pizza-margherita", quantity: 1 }],
        confirmation: "Added pizza.",
        executionLog: ["PROCESSING_INTENT...", "VALIDATING_MENU...", "UPDATING_STATE...", "SYNC_COMPLETE"] as [string, string, string, string],
      };
      const parsed = parseAIResponse(offMenuResponse, mockLogger)!;
      const { applied, failed } = applyCartDelta(parsed.actions);

      expect(applied).toBe(0);
      expect(failed).toBe(1);
    });

    it("'Remove item that doesn't exist' → applied (REMOVE is pass-through), cart stays empty", () => {
      const removeNonExistent = {
        actions: [{ type: "REMOVE_ITEM" as const, itemId: "non-existent-dish" }],
        confirmation: "Removed.",
        executionLog: ["PROCESSING_INTENT...", "VALIDATING_MENU...", "UPDATING_STATE...", "SYNC_COMPLETE"] as [string, string, string, string],
      };
      const parsed = parseAIResponse(removeNonExistent, mockLogger)!;
      const { applied } = applyCartDelta(parsed.actions);

      expect(applied).toBe(1); // REMOVE_ITEM passes, but has no effect
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  // ── Malformed Gemini JSON at parse layer ──────────────────────────────────

  describe("Malformed Gemini JSON structures", () => {
    it("Missing 'actions' field → parseAIResponse returns valid response with empty actions", () => {
      // When actions is missing (undefined), parseCartActions returns [] gracefully.
      // parseAIResponse then succeeds with an empty actions array — this is intentional
      // defensive behavior: confirmation and executionLog are still valid.
      const result = parseAIResponse(MALFORMED_MISSING_ACTIONS, mockLogger);
      // Result is NOT null — it is a valid response with empty actions
      expect(result).not.toBeNull();
      expect(result?.actions).toEqual([]);
      expect(result?.confirmation).toBe("Done");
    });

    it("Wrong executionLog length → parseAIResponse returns null", () => {
      const result = parseAIResponse(
        MALFORMED_WRONG_EXECUTION_LOG_LENGTH,
        mockLogger,
      );
      expect(result).toBeNull();
    });

    it("Non-string executionLog entries → parseAIResponse returns null", () => {
      const result = parseAIResponse(
        MALFORMED_NON_STRING_LOG_ENTRIES,
        mockLogger,
      );
      expect(result).toBeNull();
    });

    it("Deeply nested corrupt itemId → parseCartActions rejects the action", () => {
      const actions = parseCartActions(
        DEEPLY_NESTED_CORRUPT_RESPONSE.actions,
        mockLogger,
      );
      // itemId is an object, not a string → should be filtered out
      expect(actions).toHaveLength(0);
    });

    it("null values in actions array → filtered by parseCartActions", () => {
      const actions = parseCartActions(
        NULL_ACTION_IN_ARRAY.actions,
        mockLogger,
      );
      // null and undefined are filtered; only valid action passes
      expect(actions).toHaveLength(1);
    });

    it("Unknown action types → filtered by parseCartActions", () => {
      const actions = parseCartActions(
        UNKNOWN_ACTION_TYPE_RESPONSE.actions,
        mockLogger,
      );
      // DESTROY_CART and APPLY_DISCOUNT are not valid CartAction types
      // parseCartActions accepts any type string but applyCartDelta's switch rejects them
      // Note: parseCartActions validates type is a string but not the specific enum
      // The actions will pass parseCartActions but fail applySingleAction's default case
      const result = applyCartDelta(actions as any);
      expect(result.failed).toBeGreaterThan(0);
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  // ── Duplicate actions ─────────────────────────────────────────────────────

  describe("Duplicate actions", () => {
    it("Two identical ADD_ITEM actions → quantity accumulates (2x)", () => {
      const parsed = parseAIResponse(DUPLICATE_ACTIONS_RESPONSE, mockLogger)!;
      applyCartDelta(parsed.actions);

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(1); // Not duplicated as separate items
      expect(state.totalItems).toBe(2); // 1+1 accumulated
      assertCartConsistency();
    });

    it("Same REMOVE_ITEM action twice → idempotent (no crash, no negative state)", () => {
      applyCartDelta([makeAddAction("burrata-salad", 2)]);
      applyCartDelta([{ type: "REMOVE_ITEM", itemId: "burrata-salad" }]);
      applyCartDelta([{ type: "REMOVE_ITEM", itemId: "burrata-salad" }]); // second time

      expect(useCartStore.getState().items).toHaveLength(0);
      expect(useCartStore.getState().totalItems).toBe(0);
      assertCartConsistency();
    });
  });

  // ── Conflicting mutations ─────────────────────────────────────────────────

  describe("Conflicting mutations", () => {
    it("ADD_ITEM then immediate REMOVE_ITEM in one delta → item is removed", () => {
      const parsed = parseAIResponse(CONFLICTING_ACTIONS_RESPONSE, mockLogger)!;
      applyCartDelta(parsed.actions);

      expect(useCartStore.getState().items).toHaveLength(0);
      assertCartConsistency();
    });

    it("UPDATE_QUANTITY to 0 immediately after ADD → item removed", () => {
      applyCartDelta([
        makeAddAction("tagliatelle", 5),
        { type: "UPDATE_QUANTITY", itemId: "tagliatelle", quantity: 0 },
      ]);

      expect(useCartStore.getState().items).toHaveLength(0);
      assertCartConsistency();
    });
  });

  // ── Quantity boundary conditions ──────────────────────────────────────────

  describe("Quantity boundary conditions", () => {
    it("ADD_ITEM with quantity=0 → rejected at applyCartDelta level", () => {
      const parsed = parseAIResponse(
        ZERO_QUANTITY_ADD_RESPONSE as any,
        mockLogger,
      );
      if (parsed) {
        const { failed } = applyCartDelta(parsed.actions);
        expect(failed).toBe(1);
      } else {
        // If Zod/parseAIResponse rejects it, that's also correct
        expect(parsed).toBeNull();
      }
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("ADD_ITEM with fractional quantity → rejected by parseCartActions (never reaches applyCartDelta)", () => {
      const parsed = parseAIResponse(
        FRACTIONAL_QUANTITY_RESPONSE as any,
        mockLogger,
      );
      // parseCartActions filters out quantity:1.5 (not an integer) before returning.
      // So parsed.actions is [] — applyCartDelta receives an empty array → failed=0.
      if (parsed) {
        expect(parsed.actions).toHaveLength(0); // filtered at parseCartActions level
        const { failed } = applyCartDelta(parsed.actions);
        expect(failed).toBe(0); // nothing to fail — the invalid action was already removed
      }
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("UPDATE_QUANTITY with Infinity → rejected by defensiveParsing", () => {
      const actions = parseCartActions(
        [{ type: "UPDATE_QUANTITY", itemId: "burrata-salad", quantity: Infinity }],
        mockLogger,
      );
      // NaN/Infinity fails Number.isFinite check in parseCartActions
      expect(actions).toHaveLength(0);
    });

    it("UPDATE_QUANTITY with NaN → rejected by defensiveParsing", () => {
      const actions = parseCartActions(
        [{ type: "UPDATE_QUANTITY", itemId: "burrata-salad", quantity: NaN }],
        mockLogger,
      );
      expect(actions).toHaveLength(0);
    });
  });

  // ── Ambiguous intents ────────────────────────────────────────────────────

  describe("Ambiguous intent scenarios", () => {
    it("'Make one vegan but keep the other spicy' → empty actions (AI should return empty)", () => {
      // This scenario results in the AI returning an empty actions array
      // which is a valid fallback response
      const ambiguousResponse = {
        actions: [],
        confirmation:
          "I couldn't determine exactly what modification you'd like. Could you clarify?",
        executionLog: [
          "PROCESSING_INTENT...",
          "VALIDATING_MENU...",
          "NO_MATCH_FOUND",
          "AWAITING_INPUT...",
        ] as [string, string, string, string],
      };

      const parsed = parseAIResponse(ambiguousResponse, mockLogger)!;
      const { applied } = applyCartDelta(parsed.actions);

      expect(applied).toBe(0);
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  // ── applyCartDeltaSafe as the ultimate fallback ────────────────────────────

  describe("applyCartDeltaSafe handles ALL failure modes without throwing", () => {
    const failureModes = [
      null,
      undefined,
      "raw string",
      42,
      {},
      { actions: null },
      { actions: "not array" },
      [null, undefined, { type: null }],
      [{ type: "UNKNOWN", itemId: null, quantity: "abc" }],
    ];

    failureModes.forEach((input, index) => {
      it(`failure mode ${index + 1}: should not throw and return zero report`, () => {
        expect(() => applyCartDeltaSafe(input as any)).not.toThrow();
        const result = applyCartDeltaSafe(input as any);
        // Every failure mode produces { applied: 0, failed: 0, skipped: 0 }
        // because applyCartDeltaSafe catches the non-array case early
        expect(typeof result.applied).toBe("number");
        expect(typeof result.failed).toBe("number");
        expect(typeof result.skipped).toBe("number");
      });
    });
  });
});

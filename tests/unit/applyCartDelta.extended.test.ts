/**
 * applyCartDelta.extended.test.ts
 *
 * Extended test coverage beyond the existing applyCartDelta.test.ts.
 * Focuses on:
 * - Idempotency guarantees
 * - Race condition simulation (sequential rapid calls)
 * - Price accuracy to floating-point tolerances
 * - AI hallucination scenarios
 * - Full order lifecycle flows
 * - Security: large payloads, injection attempts
 */

import { applyCartDelta, applyCartDeltaSafe } from "@/lib/applyCartDelta";
import type { CartAction } from "@/lib/types";
import { useCartStore } from "@/store/cartStore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertCartConsistency,
  resetCartStore,
} from "../__helpers__/storeHelpers";
import {
  makeAddAction,
  makeRemoveAction,
  makeRealisticOrderSequence,
  makeUpdateAction,
} from "../__fixtures__/factories";
import { MENU_ITEMS, INVALID_ITEM_IDS } from "../__fixtures__/menuFixtures";

describe("applyCartDelta — Extended", () => {
  beforeEach(() => {
    resetCartStore();
    vi.clearAllMocks();
  });

  // ── Idempotency ──────────────────────────────────────────────────────────

  describe("Idempotency", () => {
    it("applying REMOVE_ITEM twice on same item should be idempotent", () => {
      applyCartDelta([makeAddAction("burrata-salad", 2)], useCartStore.getState());
      applyCartDelta([makeRemoveAction("burrata-salad")], useCartStore.getState());
      const r2 = applyCartDelta([makeRemoveAction("burrata-salad")], useCartStore.getState());

      expect(r2.applied).toBe(1); // Store silently ignores missing remove
      expect(useCartStore.getState().items).toHaveLength(0);
      assertCartConsistency();
    });

    it("applying UPDATE_QUANTITY with same value twice is idempotent", () => {
      applyCartDelta([makeAddAction("burrata-salad", 2)], useCartStore.getState());
      applyCartDelta([makeUpdateAction("burrata-salad", 5)], useCartStore.getState());
      applyCartDelta([makeUpdateAction("burrata-salad", 5)], useCartStore.getState()); // second time same

      expect(useCartStore.getState().totalItems).toBe(5);
      assertCartConsistency();
    });
  });

  // ── AI hallucination scenarios ────────────────────────────────────────────

  describe("AI hallucination scenarios", () => {
    it("should reject ALL hallucinated menu items (not on menu)", () => {
      const hallucinatedIds = [
        "pizza-margherita",
        "cheesecake",
        "burger-deluxe",
        "grilled-chicken-sandwich",
        "caesar-salad",
        "iced-cola",
        "chocolate-brownie",
      ];

      const actions: CartAction[] = hallucinatedIds.map((id) => ({
        type: "ADD_ITEM",
        itemId: id,
        quantity: 1,
      }));

      const result = applyCartDelta(actions, useCartStore.getState());
      expect(result.applied).toBe(0);
      expect(result.failed).toBe(hallucinatedIds.length);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should handle 'Add 999 burgers' — hallucinated item, extreme qty", () => {
      const result = applyCartDelta([
        { type: "ADD_ITEM", itemId: "burger", quantity: 999 },
      ], useCartStore.getState());
      expect(result.failed).toBe(1);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should handle 'Remove item that does not exist' gracefully", () => {
      const result = applyCartDelta([makeRemoveAction("nonexistent-item")], useCartStore.getState());
      // REMOVE_ITEM passes validation (doesn't require menu check)
      expect(result.applied).toBe(1);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should reject ALL invalid item IDs in INVALID_ITEM_IDS fixture", () => {
      const validIds = INVALID_ITEM_IDS.filter((id) => id !== "" && id.trim());
      // Non-empty IDs pass REMOVE_ITEM validation (no menu check for remove)
      // But for ADD_ITEM, all should fail menu validation
      for (const itemId of validIds) {
        resetCartStore();
        const result = applyCartDelta([
          { type: "ADD_ITEM", itemId, quantity: 1 },
        ], useCartStore.getState());
        expect(result.applied).toBe(0);
        expect(result.failed).toBe(1);
      }
    });
  });

  // ── Conflicting actions ───────────────────────────────────────────────────

  describe("Conflicting actions in single delta", () => {
    it("ADD then immediate REMOVE in same delta: item should be removed", () => {
      const result = applyCartDelta([
        makeAddAction("burrata-salad", 2),
        makeRemoveAction("burrata-salad"),
      ], useCartStore.getState());
      expect(result.applied).toBe(2);
      expect(useCartStore.getState().items).toHaveLength(0);
      assertCartConsistency();
    });

    it("ADD then UPDATE_QUANTITY to 0 should remove item", () => {
      applyCartDelta([
        makeAddAction("burrata-salad", 2),
        makeUpdateAction("burrata-salad", 0),
      ], useCartStore.getState());
      expect(useCartStore.getState().items).toHaveLength(0);
      assertCartConsistency();
    });

    it("multiple ADDs of same item should accumulate quantity", () => {
      applyCartDelta([
        makeAddAction("burrata-salad", 1),
        makeAddAction("burrata-salad", 1),
        makeAddAction("burrata-salad", 1),
      ], useCartStore.getState());
      expect(useCartStore.getState().totalItems).toBe(3);
      expect(useCartStore.getState().items).toHaveLength(1);
      assertCartConsistency();
    });
  });

  // ── Price accuracy ────────────────────────────────────────────────────────

  describe("Price calculation accuracy", () => {
    it("should calculate exact total for all menu items with qty 1", () => {
      const actions: CartAction[] = MENU_ITEMS.map((item) => ({
        type: "ADD_ITEM",
        itemId: item.id,
        quantity: 1,
      }));
      applyCartDelta(actions, useCartStore.getState());

      const expectedTotal = MENU_ITEMS.reduce((acc, item) => acc + item.price, 0);
      expect(useCartStore.getState().totalPrice).toBeCloseTo(expectedTotal, 2);
      assertCartConsistency();
    });

    it("should correctly compute total for 3 steak frites at $34 each = $102", () => {
      applyCartDelta([makeAddAction("steak-frites", 3)], useCartStore.getState());
      expect(useCartStore.getState().totalPrice).toBeCloseTo(102, 2);
    });

    it("should recalculate total correctly after quantity update", () => {
      applyCartDelta([makeAddAction("salmon-bowl", 2)], useCartStore.getState()); // 2 * $28 = $56
      applyCartDelta([makeUpdateAction("salmon-bowl", 1)], useCartStore.getState()); // 1 * $28 = $28
      expect(useCartStore.getState().totalPrice).toBeCloseTo(28, 2);
      assertCartConsistency();
    });
  });

  // ── Malformed payload payloads ────────────────────────────────────────────

  describe("Malformed and injection payloads", () => {
    it("should skip non-object actions in array", () => {
      const actions = [
        "string action" as any,
        42 as any,
        true as any,
        makeAddAction("burrata-salad", 1),
      ];
      const result = applyCartDelta(actions, useCartStore.getState());
      expect(result.applied).toBe(1);
      expect(result.skipped).toBe(3);
    });

    it("should handle deeply nested type field gracefully", () => {
      const malformedActions = [
        {
          type: { ADD_ITEM: true }, // nested instead of string
          itemId: "burrata-salad",
          quantity: 1,
        } as any,
      ];
      const result = applyCartDelta(malformedActions, useCartStore.getState());
      expect(result.failed).toBe(1);
    });

    it("should not crash on XSS-like itemId strings", () => {
      const actions: CartAction[] = [
        {
          type: "ADD_ITEM",
          itemId: '<script>alert("xss")</script>',
          quantity: 1,
        },
      ];
      expect(() => applyCartDelta(actions, useCartStore.getState())).not.toThrow();
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should not crash on SQL injection-like itemId strings", () => {
      const actions: CartAction[] = [
        {
          type: "ADD_ITEM",
          itemId: "'; DROP TABLE items; --",
          quantity: 1,
        },
      ];
      expect(() => applyCartDelta(actions, useCartStore.getState())).not.toThrow();
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should handle extremely large arrays without crashing", () => {
      const actions: CartAction[] = Array(500).fill({
        type: "ADD_ITEM",
        itemId: "fake-item",
        quantity: 1,
      });
      expect(() => applyCartDelta(actions, useCartStore.getState())).not.toThrow();
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  // ── Rapid sequential mutations (race condition simulation) ────────────────

  describe("Rapid sequential mutations", () => {
    it("final state should be deterministic after rapid add/remove cycles", () => {
      for (let i = 0; i < 10; i++) {
        applyCartDelta([makeAddAction("burrata-salad", 1)], useCartStore.getState());
        applyCartDelta([makeRemoveAction("burrata-salad")], useCartStore.getState());
      }
      expect(useCartStore.getState().items).toHaveLength(0);
      assertCartConsistency();
    });

    it("rapid quantity updates should converge to final value", () => {
      applyCartDelta([makeAddAction("tagliatelle", 1)], useCartStore.getState());
      for (let i = 1; i <= 20; i++) {
        applyCartDelta([makeUpdateAction("tagliatelle", i)], useCartStore.getState());
      }
      expect(useCartStore.getState().totalItems).toBe(20);
      assertCartConsistency();
    });
  });

  // ── Full realistic order lifecycle ────────────────────────────────────────

  describe("Realistic order lifecycle", () => {
    it("should handle a complete order session correctly", () => {
      const sequence = makeRealisticOrderSequence();
      // Sequence: add burrata(1), add tagliatelle(2), add yuzu(2),
      //           update tagliatelle→1, remove yuzu, add cold-brew(2)

      for (const action of sequence) {
        applyCartDelta([action], useCartStore.getState());
      }

      const state = useCartStore.getState();
      // Expected final cart:
      // burrata-salad: 1 ($14)
      // tagliatelle: 1 ($24)
      // cold-brew: 2 ($9 * 2 = $18)
      expect(state.items).toHaveLength(3);
      expect(state.totalItems).toBe(4);
      expect(state.totalPrice).toBeCloseTo(14 + 24 + 18, 2);
      assertCartConsistency();
    });
  });

  // ── applyCartDeltaSafe edge cases ─────────────────────────────────────────

  describe("applyCartDeltaSafe — additional coverage", () => {
    it("should handle Symbol input without throwing", () => {
      expect(() => applyCartDeltaSafe(Symbol("test") as any, useCartStore.getState())).not.toThrow();
    });

    it("should handle circular reference without crashing", () => {
      // Can't JSON.stringify circular refs, but applyCartDeltaSafe should survive
      const obj: any = {};
      obj.self = obj;
      expect(() => applyCartDeltaSafe(obj, useCartStore.getState())).not.toThrow();
    });

    it("should work with deeply nested array of arrays", () => {
      // [[{type:"ADD_ITEM"}]] is an array, so applyCartDeltaSafe processes it
      // The inner arrays are non-object CartActions so they fail
      const result = applyCartDeltaSafe([[{ type: "ADD_ITEM" }]] as any, useCartStore.getState());
      // Inner array wrapping produces a failed action, not zero
      expect(result.applied).toBe(0);
      expect(typeof result.failed).toBe("number");
    });
  });
});

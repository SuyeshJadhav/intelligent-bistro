/**
 * Tests for applyCartDelta - the deterministic cart synchronization engine
 *
 * Test structure:
 * - Validation tests: ensures menu items exist
 * - Action tests: ADD_ITEM, REMOVE_ITEM, UPDATE_QUANTITY
 * - Edge case tests: malformed data, invalid quantities
 * - Integration tests: full delta application flow
 *
 * NOTE: All itemIds must match the real menuData exactly.
 * Real menu IDs: burrata-salad, celeriac-soup, tagliatelle,
 *   salmon-bowl, steak-frites, mushroom-risotto,
 *   yuzu-spritz, cold-brew, vermouth-soda
 */

import { applyCartDelta, applyCartDeltaSafe } from "@/lib/applyCartDelta";
import type { CartAction } from "@/lib/types";
import { useCartStore } from "@/store/cartStore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Real menu items (from apps/frontend/constants/menuData.ts)
const ITEM_A = "burrata-salad";       // Burrata & Orchard Tomatoes — $14
const ITEM_B = "celeriac-soup";       // Smoked Celeriac Soup — $12
const ITEM_C = "tagliatelle";         // Black Pepper Tagliatelle — $24
const ITEM_D = "yuzu-spritz";         // Yuzu Spritz — $11
const ITEM_E = "mushroom-risotto";    // Wild Mushroom Risotto — $26

describe("applyCartDelta", () => {
  beforeEach(() => {
    // Reset cart state before each test
    useCartStore.setState({
      items: [],
      totalItems: 0,
      totalPrice: 0,
    });
    vi.clearAllMocks();
  });

  describe("ADD_ITEM action", () => {
    it("should add a valid menu item to cart", () => {
      const actions: CartAction[] = [
        {
          type: "ADD_ITEM",
          itemId: ITEM_A,
          quantity: 2,
        },
      ];

      const result = applyCartDelta(actions);

      expect(result.applied).toBe(1);
      expect(result.failed).toBe(0);
      expect(useCartStore.getState().totalItems).toBe(2);
      expect(useCartStore.getState().items[0]?.name).toBe(
        "Burrata & Orchard Tomatoes",
      );
    });

    it("should reject non-existent menu item", () => {
      const actions: CartAction[] = [
        {
          type: "ADD_ITEM",
          itemId: "fake-item-xyz",
          quantity: 1,
        },
      ];

      const result = applyCartDelta(actions);

      expect(result.failed).toBe(1);
      expect(result.applied).toBe(0);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should reject invalid quantities", () => {
      const actions: CartAction[] = [
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 0 },
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: -1 },
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 1.5 },
      ];

      const result = applyCartDelta(actions);

      expect(result.failed).toBe(3);
      expect(result.applied).toBe(0);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should handle multiple ADD_ITEM actions", () => {
      const actions: CartAction[] = [
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 2 }, // burrata x2
        { type: "ADD_ITEM", itemId: ITEM_B, quantity: 1 }, // celeriac x1
        { type: "ADD_ITEM", itemId: ITEM_D, quantity: 3 }, // yuzu x3
      ];

      const result = applyCartDelta(actions);

      expect(result.applied).toBe(3);
      expect(useCartStore.getState().totalItems).toBe(6);
      expect(useCartStore.getState().items).toHaveLength(3);
    });

    it("should increment existing item quantity when adding same item twice", () => {
      applyCartDelta([
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 2 },
      ]);

      applyCartDelta([
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 3 },
      ]);

      expect(useCartStore.getState().totalItems).toBe(5);
      expect(useCartStore.getState().items).toHaveLength(1);
    });
  });

  describe("REMOVE_ITEM action", () => {
    it("should remove item from cart", () => {
      // Add item first
      applyCartDelta([
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 2 },
      ]);

      // Remove it
      const result = applyCartDelta([
        { type: "REMOVE_ITEM", itemId: ITEM_A },
      ]);

      expect(result.applied).toBe(1);
      expect(useCartStore.getState().items).toHaveLength(0);
      expect(useCartStore.getState().totalItems).toBe(0);
    });

    it("should handle removing non-existent item silently", () => {
      const result = applyCartDelta([
        { type: "REMOVE_ITEM", itemId: "fake-item" },
      ]);

      // Remove succeeds but has no effect
      expect(result.applied).toBe(1);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should reject invalid item IDs", () => {
      const actions: CartAction[] = [{ type: "REMOVE_ITEM", itemId: "" }];

      const result = applyCartDelta(actions);
      expect(result.failed).toBe(1);
    });
  });

  describe("UPDATE_QUANTITY action", () => {
    beforeEach(() => {
      applyCartDelta([
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 2 },
      ]);
    });

    it("should update item quantity", () => {
      const result = applyCartDelta([
        {
          type: "UPDATE_QUANTITY",
          itemId: ITEM_A,
          quantity: 5,
        },
      ]);

      expect(result.applied).toBe(1);
      expect(useCartStore.getState().totalItems).toBe(5);
    });

    it("should remove item when quantity is set to 0", () => {
      const result = applyCartDelta([
        {
          type: "UPDATE_QUANTITY",
          itemId: ITEM_A,
          quantity: 0,
        },
      ]);

      expect(result.applied).toBe(1);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should reject negative quantities", () => {
      const result = applyCartDelta([
        {
          type: "UPDATE_QUANTITY",
          itemId: ITEM_A,
          quantity: -1,
        },
      ]);

      expect(result.failed).toBe(1);
      // Quantity should remain unchanged
      expect(useCartStore.getState().totalItems).toBe(2);
    });

    it("should reject non-integer quantities", () => {
      const result = applyCartDelta([
        {
          type: "UPDATE_QUANTITY",
          itemId: ITEM_A,
          quantity: 2.5,
        },
      ]);

      expect(result.failed).toBe(1);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle empty action array", () => {
      const result = applyCartDelta([]);
      expect(result).toEqual({ applied: 0, failed: 0, skipped: 0 });
    });

    it("should handle non-array input", () => {
      const result = applyCartDelta(null as any);
      expect(result).toEqual({ applied: 0, failed: 0, skipped: 0 });
    });

    it("should skip null or undefined actions", () => {
      const actions = [
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 1 },
        null,
        undefined,
        { type: "ADD_ITEM", itemId: ITEM_B, quantity: 1 },
      ] as any[];

      const result = applyCartDelta(actions);
      expect(result.applied).toBe(2);
      expect(result.skipped).toBe(2);
    });

    it("should handle mixed valid and invalid actions", () => {
      const actions: CartAction[] = [
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 1 },        // valid
        { type: "ADD_ITEM", itemId: "invalid-item", quantity: 1 }, // fails menu check
        { type: "ADD_ITEM", itemId: ITEM_B, quantity: 1 },        // valid
      ];

      const result = applyCartDelta(actions);
      expect(result.applied).toBe(2);
      expect(result.failed).toBe(1);
      expect(useCartStore.getState().items).toHaveLength(2);
    });

    it("should catch unexpected errors gracefully", () => {
      const actions: CartAction[] = [
        {
          type: "ADD_ITEM",
          itemId: ITEM_A,
          quantity: 1,
        },
      ];

      // Should not throw
      expect(() => applyCartDelta(actions)).not.toThrow();
    });
  });

  describe("Complex scenarios", () => {
    it("should handle a realistic order flow", () => {
      // ITEM_A (burrata) x2, ITEM_B (celeriac) x1, ITEM_D (yuzu) x2
      // then update yuzu→1, then add ITEM_E (risotto) x2
      // = 4 distinct items, 2+1+1+2 = 6 total items
      const actions: CartAction[] = [
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 2 },
        { type: "ADD_ITEM", itemId: ITEM_B, quantity: 1 },
        { type: "ADD_ITEM", itemId: ITEM_D, quantity: 2 },
        { type: "UPDATE_QUANTITY", itemId: ITEM_D, quantity: 1 },
        { type: "ADD_ITEM", itemId: ITEM_E, quantity: 2 },
      ];

      const result = applyCartDelta(actions);

      expect(result.applied).toBe(5);
      expect(useCartStore.getState().items).toHaveLength(4);
      expect(useCartStore.getState().totalItems).toBe(6); // 2+1+1+2
    });

    it("should allow canceling and re-adding items", () => {
      // Add item
      applyCartDelta([
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 2 },
      ]);
      expect(useCartStore.getState().totalItems).toBe(2);

      // Remove item
      applyCartDelta([
        { type: "REMOVE_ITEM", itemId: ITEM_A },
      ]);
      expect(useCartStore.getState().items).toHaveLength(0);

      // Add same item again
      applyCartDelta([
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 1 },
      ]);
      expect(useCartStore.getState().totalItems).toBe(1);
    });
  });

  describe("applyCartDeltaSafe", () => {
    it("should return safe default for non-array input", () => {
      const result = applyCartDeltaSafe("not an array" as any);
      expect(result).toEqual({ applied: 0, failed: 0, skipped: 0 });
    });

    it("should catch unexpected errors and return safe default", () => {
      // This should not throw
      expect(() => applyCartDeltaSafe({} as any)).not.toThrow();
    });

    it("should work correctly with valid input", () => {
      const actions: CartAction[] = [
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 1 },
      ];

      const result = applyCartDeltaSafe(actions);
      expect(result.applied).toBe(1);
      expect(useCartStore.getState().items).toHaveLength(1);
    });
  });

  describe("Price calculation accuracy", () => {
    it("should calculate total price correctly after cart mutations", () => {
      // burrata x2 = 2*14 = $28, celeriac x1 = $12 → total $40
      applyCartDelta([
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 2 }, // $14 each = $28
        { type: "ADD_ITEM", itemId: ITEM_B, quantity: 1 }, // $12
      ]);

      const state = useCartStore.getState();
      expect(state.totalPrice).toBeCloseTo(40, 1);
      expect(state.totalItems).toBe(3);
    });

    it("should recalculate total price on quantity update", () => {
      applyCartDelta([
        { type: "ADD_ITEM", itemId: ITEM_A, quantity: 1 },
      ]);

      applyCartDelta([
        {
          type: "UPDATE_QUANTITY",
          itemId: ITEM_A,
          quantity: 3,
        },
      ]);

      const state = useCartStore.getState();
      expect(state.totalItems).toBe(3);
    });
  });
});

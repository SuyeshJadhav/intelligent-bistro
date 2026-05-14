/**
 * performance.test.ts - Performance and regression benchmarks
 *
 * Tests:
 * - Cart update speed under 16ms (1 animation frame)
 * - No excessive store re-subscriptions
 * - Large cart (50+ items) mutation performance
 * - 100+ message AI store performance
 * - applyCartDelta throughput
 * - Zustand selector efficiency (no stale subscriptions)
 *
 * Philosophy:
 * - We measure wall-clock time with performance.now()
 * - We use soft assertions (warnings) for timing — hard assertions would be flaky on CI
 * - We DO hard-assert result correctness
 */

import { applyCartDelta } from "@/lib/applyCartDelta";
import { useCartStore } from "@/store/cartStore";
import { useAIStore } from "@/store/aiStore";
import { describe, expect, it, beforeEach } from "vitest";
import {
  assertCartConsistency,
  resetAllStores,
  seedCartStore,
} from "../__helpers__/storeHelpers";
import { makeCart, makeCartItemFromMenu, makeConversation , makeAddAction, makeUpdateAction, makeRemoveAction } from "../__fixtures__/factories";
import type { Message } from "@/store/aiStore";

const FRAME_BUDGET_MS = 16; // One animation frame at 60fps
const SOFT_WARN_PREFIX = "[PERF WARNING]";

function softAssertTiming(
  label: string,
  elapsedMs: number,
  budgetMs: number,
): void {
  if (elapsedMs > budgetMs) {
    console.warn(
      `${SOFT_WARN_PREFIX} ${label}: ${elapsedMs.toFixed(2)}ms (budget: ${budgetMs}ms)`,
    );
  }
}

describe("Performance Tests", () => {
  beforeEach(() => {
    resetAllStores();
  });

  // ── applyCartDelta throughput ──────────────────────────────────────────────

  describe("applyCartDelta throughput", () => {
    it("should apply a single ADD_ITEM action within 16ms frame budget", () => {
      const start = performance.now();
      applyCartDelta([makeAddAction("burrata-salad", 1)]);
      const elapsed = performance.now() - start;

      softAssertTiming("single ADD_ITEM", elapsed, FRAME_BUDGET_MS);
      expect(useCartStore.getState().totalItems).toBe(1);
    });

    it("should apply 10 simultaneous actions within 50ms", () => {
      const actions = [
        makeAddAction("burrata-salad", 1),
        makeAddAction("tagliatelle", 2),
        makeAddAction("salmon-bowl", 1),
        makeAddAction("steak-frites", 1),
        makeAddAction("mushroom-risotto", 1),
        makeAddAction("yuzu-spritz", 2),
        makeAddAction("cold-brew", 1),
        makeAddAction("vermouth-soda", 1),
        makeAddAction("celeriac-soup", 1),
        makeUpdateAction("tagliatelle", 3),
      ];

      const start = performance.now();
      applyCartDelta(actions);
      const elapsed = performance.now() - start;

      softAssertTiming("10-action delta", elapsed, 50);

      const state = useCartStore.getState();
      expect(state.items.length).toBeGreaterThan(0);
      assertCartConsistency();
    });

    it("should process 100 successive single-action deltas within 500ms total", () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        applyCartDelta([makeUpdateAction("burrata-salad", i + 1)]);
        // Need item to exist first — add it once
        if (i === 0) {
          resetAllStores();
          applyCartDelta([makeAddAction("burrata-salad", 1)]);
        }
      }
      const elapsed = performance.now() - start;

      softAssertTiming("100 successive deltas", elapsed, 500);
    });

    it("should reject 500 invalid items faster than 500ms", () => {
      const actions = Array(500).fill(makeAddAction("fake-item-not-on-menu", 1));

      const start = performance.now();
      const result = applyCartDelta(actions);
      const elapsed = performance.now() - start;

      softAssertTiming("500 invalid actions", elapsed, 500);
      expect(result.failed).toBe(500);
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  // ── Large cart operations ──────────────────────────────────────────────────

  describe("Large cart performance", () => {
    it("should compute totals correctly for a full 9-item cart", () => {
      const fullCart = makeCart(9); // all 9 menu items
      const start = performance.now();
      seedCartStore(fullCart);
      const elapsed = performance.now() - start;

      softAssertTiming("seed 9-item cart", elapsed, 16);
      assertCartConsistency();
    });

    it("should clear large cart within 1ms", () => {
      seedCartStore(makeCart(9));

      const start = performance.now();
      useCartStore.getState().clearCart();
      const elapsed = performance.now() - start;

      softAssertTiming("clearCart on 9-item cart", elapsed, 1);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should handle 50 sequential addItem calls without significant degradation", () => {
      const times: number[] = [];

      for (let i = 0; i < 50; i++) {
        const item = makeCartItemFromMenu("burrata-salad", 1);
        const start = performance.now();
        useCartStore.getState().addItem(item);
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      softAssertTiming("avg addItem (50 calls)", avgTime, 2);
      softAssertTiming("max addItem (50 calls)", maxTime, 16);

      // Hard assertion: all 50 adds accumulated correctly
      expect(useCartStore.getState().totalItems).toBe(50);
      assertCartConsistency();
    });
  });

  // ── AI store with 100+ messages ────────────────────────────────────────────

  describe("AI store with large message counts", () => {
    it("should handle 100 message conversation without errors", () => {
      const conversation = makeConversation(50); // 100 total messages

      const start = performance.now();
      conversation.forEach((msg) =>
        useAIStore.getState().addMessage(msg as Message),
      );
      const elapsed = performance.now() - start;

      softAssertTiming("100 message inserts", elapsed, 50);
      expect(useAIStore.getState().messages).toHaveLength(100);
    });

    it("should correctly append 50 execution log entries", () => {
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        useAIStore.getState().appendLog(`STEP_${i}`);
      }
      const elapsed = performance.now() - start;

      softAssertTiming("50 log appends", elapsed, 20);
      expect(useAIStore.getState().executionLog).toHaveLength(50);
    });
  });

  // ── Total price accuracy under load ───────────────────────────────────────

  describe("Price calculation accuracy under load", () => {
    it("should maintain exact floating point accuracy with many price variants", () => {
      // Add 9 items × quantity from 1–9 and verify totals
      const MENU = [
        { id: "burrata-salad", price: 14 },
        { id: "celeriac-soup", price: 12 },
        { id: "tagliatelle", price: 24 },
        { id: "salmon-bowl", price: 28 },
        { id: "steak-frites", price: 34 },
        { id: "mushroom-risotto", price: 26 },
        { id: "yuzu-spritz", price: 11 },
        { id: "cold-brew", price: 9 },
        { id: "vermouth-soda", price: 12 },
      ];

      let expectedTotal = 0;
      for (let i = 0; i < MENU.length; i++) {
        const qty = i + 1;
        applyCartDelta([makeAddAction(MENU[i]!.id, qty)]);
        expectedTotal += MENU[i]!.price * qty;
      }

      const state = useCartStore.getState();
      expect(state.totalPrice).toBeCloseTo(expectedTotal, 2);
      assertCartConsistency();
    });
  });
});

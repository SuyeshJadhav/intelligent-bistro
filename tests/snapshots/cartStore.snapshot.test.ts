/**
 * cartStore.snapshot.test.ts - Snapshot tests for cart state shapes
 *
 * Validates that the store state shape never silently changes.
 * These tests act as a canary: if store shape changes, snapshot breaks
 * and the engineer must intentionally update it.
 */

import { useCartStore } from "@/store/cartStore";
import { useAIStore } from "@/store/aiStore";
import { describe, expect, it, beforeEach } from "vitest";
import { resetAllStores, seedCartStore } from "../__helpers__/storeHelpers";
import { makeCartItemFromMenu , makeAddAction } from "../__fixtures__/factories";
import { applyCartDelta } from "@/lib/applyCartDelta";
import {
  parseCartActions,
  parseAIResponse,
  parseExecutionLog,
} from "@/lib/defensiveParsing";

describe("Snapshot Tests", () => {
  beforeEach(() => {
    resetAllStores();
  });

  // ── Cart store shape snapshots ─────────────────────────────────────────────

  describe("Cart store state shape", () => {
    it("should snapshot empty cart state", () => {
      const state = {
        items: useCartStore.getState().items,
        totalItems: useCartStore.getState().totalItems,
        totalPrice: useCartStore.getState().totalPrice,
      };
      expect(state).toMatchSnapshot();
    });

    it("should snapshot single-item cart", () => {
      applyCartDelta([makeAddAction("burrata-salad", 2)]);

      const { items, totalItems, totalPrice } = useCartStore.getState();
      const snapshot = {
        itemCount: items.length,
        totalItems,
        totalPrice,
        firstItem: {
          id: items[0]?.id,
          name: items[0]?.name,
          quantity: items[0]?.quantity,
          price: items[0]?.price,
        },
      };
      expect(snapshot).toMatchSnapshot();
    });

    it("should snapshot multi-item cart", () => {
      applyCartDelta([
        makeAddAction("burrata-salad", 1),
        makeAddAction("tagliatelle", 2),
        makeAddAction("yuzu-spritz", 3),
      ]);

      const { items, totalItems, totalPrice } = useCartStore.getState();
      const snapshot = {
        itemCount: items.length,
        totalItems,
        totalPrice,
        itemIds: items.map((i) => i.id).sort(),
      };
      expect(snapshot).toMatchSnapshot();
    });
  });

  // ── AI store shape snapshots ────────────────────────────────────────────────

  describe("AI store state shape", () => {
    it("should snapshot initial AI store state", () => {
      const { isOpen, isProcessing, messages, executionLog } =
        useAIStore.getState();
      expect({ isOpen, isProcessing, messages, executionLog }).toMatchSnapshot();
    });

    it("should snapshot AI store after message exchange", () => {
      useAIStore.getState().openAI();
      useAIStore.getState().setProcessing(true);
      useAIStore.getState().sendMessage("Add 2 burrata salads");
      useAIStore.getState().addMessage({
        role: "ai",
        content: "Added 2 burrata salads to your cart.",
      });
      useAIStore.getState().setProcessing(false);
      useAIStore.getState().appendLog("PROCESSING_INTENT...");
      useAIStore.getState().appendLog("SYNC_COMPLETE");

      const { isOpen, isProcessing, messages, executionLog } =
        useAIStore.getState();
      expect({
        isOpen,
        isProcessing,
        messageCount: messages.length,
        messageRoles: messages.map((m) => m.role),
        executionLog,
      }).toMatchSnapshot();
    });
  });

  // ── Return value shape snapshots ───────────────────────────────────────────

  describe("applyCartDelta return shape", () => {
    it("should snapshot return value for successful apply", () => {
      const result = applyCartDelta([makeAddAction("burrata-salad", 1)]);
      expect(result).toMatchSnapshot();
    });

    it("should snapshot return value for all-failed apply", () => {
      const result = applyCartDelta([
        { type: "ADD_ITEM", itemId: "fake-item", quantity: 1 },
        { type: "ADD_ITEM", itemId: "another-fake", quantity: 1 },
      ]);
      expect(result).toMatchSnapshot();
    });

    it("should snapshot return value for mixed apply", () => {
      const result = applyCartDelta([
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
        { type: "ADD_ITEM", itemId: "fake-item", quantity: 1 },
        null as any,
      ]);
      expect(result).toMatchSnapshot();
    });
  });

  // ── defensiveParsing output shapes ────────────────────────────────────────

  describe("defensiveParsing output shapes", () => {
    it("should snapshot parseCartActions output for valid input", () => {
      const result = parseCartActions([
        { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 2 },
        { type: "REMOVE_ITEM", itemId: "tagliatelle" },
        { type: "UPDATE_QUANTITY", itemId: "salmon-bowl", quantity: 3 },
      ]);
      expect(result).toMatchSnapshot();
    });

    it("should snapshot parseAIResponse output for valid response", () => {
      const result = parseAIResponse({
        actions: [{ type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 }],
        confirmation: "Added burrata salad.",
        executionLog: [
          "PROCESSING_INTENT...",
          "VALIDATING_MENU...",
          "UPDATING_STATE...",
          "SYNC_COMPLETE",
        ],
      });
      expect(result).toMatchSnapshot();
    });

    it("should snapshot parseExecutionLog defaults for empty input", () => {
      const result = parseExecutionLog([]);
      expect(result).toMatchSnapshot();
    });

    it("should snapshot parseExecutionLog for valid 4-entry log", () => {
      const result = parseExecutionLog([
        "PROCESSING_INTENT...",
        "VALIDATING_MENU...",
        "UPDATING_STATE...",
        "SYNC_COMPLETE",
      ]);
      expect(result).toMatchSnapshot();
    });
  });
});

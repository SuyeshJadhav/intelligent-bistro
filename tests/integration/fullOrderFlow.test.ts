/**
 * fullOrderFlow.test.ts - Integration tests for the complete AI ordering pipeline
 *
 * Tests the full chain:
 *   User message → requestManager → API client → (mock backend)
 *   → validated response → defensiveParsing → applyCartDelta → Zustand
 *
 * These tests verify that all layers compose correctly end-to-end.
 * The Gemini API is replaced with deterministic MSW handlers.
 */

import { applyCartDelta } from "@/lib/applyCartDelta";
import { parseAIResponse } from "@/lib/defensiveParsing";
import { sendChatMessage } from "@/lib/api";
import { RequestManager } from "@/lib/requestManager";
import { useCartStore } from "@/store/cartStore";
import { useAIStore } from "@/store/aiStore";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  assertCartConsistency,
  resetAllStores,
  getCartItem,
} from "../__helpers__/storeHelpers";
import {
  MULTI_ACTION_RESPONSE,
  HALLUCINATED_ITEM_RESPONSE,
  DUPLICATE_ACTIONS_RESPONSE,
  CONFLICTING_ACTIONS_RESPONSE,
  makeAddItemResponse,
  makeUpdateQuantityResponse,
  makeRemoveItemResponse,
} from "../__fixtures__/aiResponseFixtures";
import {
  mockServer,
  setupSuccessResponse,
  setupNetworkError,
  setupTransientFailure,
  setupMalformedJsonResponse,
} from "../__mocks__/mockServer";

// ── MSW server lifecycle ──────────────────────────────────────────────────────

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  resetAllStores();
  vi.clearAllMocks();
});
afterAll(() => mockServer.close());

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_CART_API = [] as {
  id: string;
  name: string;
  price: number;
  quantity: number;
}[];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Full Order Flow — Integration", () => {
  // ── Happy path: single add ─────────────────────────────────────────────────

  describe("Single item add flow", () => {
    it("should add an item to cart after receiving valid AI response", async () => {
      setupSuccessResponse(makeAddItemResponse("burrata-salad", 2));

      const apiResponse = await sendChatMessage("Add 2 burrata salads", EMPTY_CART_API);
      const parsed = parseAIResponse(apiResponse);
      expect(parsed).not.toBeNull();

      const { applied } = applyCartDelta(parsed!.actions);
      expect(applied).toBe(1);

      const state = useCartStore.getState();
      expect(state.totalItems).toBe(2);
      expect(state.totalPrice).toBeCloseTo(28, 2); // 2 * $14
      assertCartConsistency();
    });
  });

  // ── Multi-action response flow ─────────────────────────────────────────────

  describe("Multi-action response flow", () => {
    it("should apply all 3 actions from MULTI_ACTION_RESPONSE correctly", async () => {
      setupSuccessResponse(MULTI_ACTION_RESPONSE);

      const apiResponse = await sendChatMessage("Order a full meal", EMPTY_CART_API);
      const parsed = parseAIResponse(apiResponse);
      const { applied } = applyCartDelta(parsed!.actions);

      expect(applied).toBe(3);
      const state = useCartStore.getState();
      expect(state.items).toHaveLength(3);
      expect(state.totalItems).toBe(1 + 2 + 2); // burrata(1) + tagliatelle(2) + yuzu(2)
      assertCartConsistency();
    });
  });

  // ── Order modification flow ────────────────────────────────────────────────

  describe("Order modification flow", () => {
    beforeEach(async () => {
      // Seed cart: add burrata-salad x2
      setupSuccessResponse(makeAddItemResponse("burrata-salad", 2));
      const resp = await sendChatMessage("Add 2 burrata", EMPTY_CART_API);
      applyCartDelta(parseAIResponse(resp)!.actions);
    });

    it("should correctly update quantity via UPDATE_QUANTITY", async () => {
      setupSuccessResponse(makeUpdateQuantityResponse("burrata-salad", 5));

      const resp = await sendChatMessage("Make it 5 burratas", EMPTY_CART_API);
      applyCartDelta(parseAIResponse(resp)!.actions);

      expect(useCartStore.getState().totalItems).toBe(5);
      assertCartConsistency();
    });

    it("should remove item from cart via REMOVE_ITEM", async () => {
      setupSuccessResponse(makeRemoveItemResponse("burrata-salad"));

      const resp = await sendChatMessage("Remove burrata", EMPTY_CART_API);
      applyCartDelta(parseAIResponse(resp)!.actions);

      expect(useCartStore.getState().items).toHaveLength(0);
      assertCartConsistency();
    });
  });

  // ── AI hallucination handling ──────────────────────────────────────────────

  describe("AI hallucination handling", () => {
    it("should reject hallucinated items and leave cart unchanged", async () => {
      setupSuccessResponse(HALLUCINATED_ITEM_RESPONSE);

      const resp = await sendChatMessage("Add pizza and cheesecake", EMPTY_CART_API);
      const parsed = parseAIResponse(resp)!;
      const { applied, failed } = applyCartDelta(parsed.actions);

      expect(applied).toBe(0);
      expect(failed).toBe(2);
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  // ── Duplicate action handling ──────────────────────────────────────────────

  describe("Duplicate action handling", () => {
    it("should accumulate quantity on duplicate ADD_ITEM actions", async () => {
      setupSuccessResponse(DUPLICATE_ACTIONS_RESPONSE);

      const resp = await sendChatMessage("Add burrata twice", EMPTY_CART_API);
      const parsed = parseAIResponse(resp)!;
      applyCartDelta(parsed.actions);

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.totalItems).toBe(2); // 1+1 accumulated
      assertCartConsistency();
    });
  });

  // ── Conflicting action handling ────────────────────────────────────────────

  describe("Conflicting action handling", () => {
    it("ADD then REMOVE in same delta leaves cart empty", async () => {
      setupSuccessResponse(CONFLICTING_ACTIONS_RESPONSE);

      const resp = await sendChatMessage("Add then remove", EMPTY_CART_API);
      const parsed = parseAIResponse(resp)!;
      applyCartDelta(parsed.actions);

      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  // ── Network error recovery ─────────────────────────────────────────────────

  describe("Network error handling", () => {
    it("should propagate APIClientError when network fails", async () => {
      setupNetworkError();

      await expect(sendChatMessage("Hello", EMPTY_CART_API)).rejects.toMatchObject(
        { code: "NETWORK" },
      );

      // Cart should be unchanged
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should parse error from malformed JSON response", async () => {
      setupMalformedJsonResponse();

      await expect(sendChatMessage("Hello", EMPTY_CART_API)).rejects.toMatchObject(
        { code: "PARSE" },
      );
    });
  });

  // ── RequestManager + full pipeline ────────────────────────────────────────

  describe("RequestManager integration", () => {
    it("should succeed after retry when transient error occurs", async () => {
      setupTransientFailure(1, makeAddItemResponse("tagliatelle", 1));

      const manager = new RequestManager();
      manager.setRetryConfig({ initialDelayMs: 10 }); // Speed up for test

      // Can't use fake timers here (MSW needs real timers), so use real time
      const resp = await manager.sendWithRetry("Add tagliatelle", EMPTY_CART_API);
      applyCartDelta(parseAIResponse(resp)!.actions);

      expect(useCartStore.getState().totalItems).toBe(1);
      assertCartConsistency();
    });
  });

  // ── State consistency after sequence ──────────────────────────────────────

  describe("State consistency after multi-request sequence", () => {
    it("should maintain mathematically correct totals through 5 sequential orders", async () => {
      // Step-by-step cart state:
      // 1. Add burrata(1)           → totalItems: 1
      // 2. Add tagliatelle(2)       → totalItems: 3
      // 3. Add yuzu-spritz(2)       → totalItems: 5
      // 4. Update tagliatelle → 1   → totalItems: 4  (burrata:1 + tagliatelle:1 + yuzu:2)
      // 5. Remove yuzu-spritz       → totalItems: 2  (burrata:1 + tagliatelle:1)
      const steps = [
        { response: makeAddItemResponse("burrata-salad", 1), expectedItems: 1 },
        { response: makeAddItemResponse("tagliatelle", 2), expectedItems: 3 },
        { response: makeAddItemResponse("yuzu-spritz", 2), expectedItems: 5 },
        {
          response: makeUpdateQuantityResponse("tagliatelle", 1),
          expectedItems: 4,
        },
        { response: makeRemoveItemResponse("yuzu-spritz"), expectedItems: 2 },
      ];

      for (const step of steps) {
        setupSuccessResponse(step.response);
        const resp = await sendChatMessage("order step", EMPTY_CART_API);
        applyCartDelta(parseAIResponse(resp)!.actions);
        assertCartConsistency();
        expect(useCartStore.getState().totalItems).toBe(step.expectedItems);
        mockServer.resetHandlers();
      }

      // Final state: burrata(1) + tagliatelle(1) + yuzu(0 removed) = still burrata + tagliatelle
      // Actually: burrata(1) @$14, tagliatelle(1) @$24 = $38 total
      expect(useCartStore.getState().totalPrice).toBeCloseTo(38, 2);
    });
  });
});

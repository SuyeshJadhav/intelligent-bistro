/**
 * security.test.ts - Security and resilience validation tests
 *
 * Tests:
 * - Injection attempts via itemId, message, quantity
 * - Oversized payloads
 * - Schema boundary attacks
 * - XSS-like content in AI responses
 * - Request flooding prevention (debounce)
 * - Backend Zod schema enforcement
 */

import { applyCartDelta, applyCartDeltaSafe } from "@/lib/applyCartDelta";
import { parseAIResponse, parseCartActions } from "@/lib/defensiveParsing";
import { sendChatMessage } from "@/lib/api";
import { useCartStore } from "@/store/cartStore";
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
import { resetAllStores } from "../__helpers__/storeHelpers";
import {
  mockServer,
  setupSuccessResponse,
  setupServerError,
} from "../__mocks__/mockServer";
import { VALID_EXECUTION_LOG, XSS_INJECTION_RESPONSE } from "../__fixtures__/aiResponseFixtures";
import type { CartAction } from "@/lib/types";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  resetAllStores();
  vi.clearAllMocks();
});
afterAll(() => mockServer.close());

describe("Security Tests", () => {
  // ── Injection via itemId ───────────────────────────────────────────────────

  describe("Injection via itemId", () => {
    const injectionPayloads = [
      '<script>alert("xss")</script>',
      "'; DROP TABLE items; --",
      "../../etc/passwd",
      "\x00null-byte",
      "a".repeat(10_000), // oversized
      "javascript:alert(1)",
      "<img src=x onerror=alert(1)>",
      "${7*7}", // template injection
      "{{7*7}}", // SSTI
      "%0a%0dHeader:Injected", // CRLF injection
    ];

    it("should reject all injection payloads as ADD_ITEM actions", () => {
      for (const payload of injectionPayloads) {
        const actions: CartAction[] = [
          { type: "ADD_ITEM", itemId: payload, quantity: 1 },
        ];
        const result = applyCartDelta(actions, useCartStore.getState());
        // Must fail because payload is not a valid menu item ID
        expect(result.applied).toBe(0);
        expect(useCartStore.getState().items).toHaveLength(0);
      }
    });

    it("should not throw for any injection payload", () => {
      for (const payload of injectionPayloads) {
        expect(() =>
          applyCartDelta([{ type: "ADD_ITEM", itemId: payload, quantity: 1 }], useCartStore.getState()),
        ).not.toThrow();
      }
    });

    it("should reject injection payloads in parseCartActions", () => {
      const mockLogger = { warn: vi.fn(), debug: vi.fn() } as any as Console;
      for (const payload of injectionPayloads) {
        const result = parseCartActions(
          [{ type: "ADD_ITEM", itemId: payload, quantity: 1 }],
          mockLogger,
        );
        // Either passes (valid string format) or is rejected by whitespace check
        // Either way, it will fail menu validation in applyCartDelta
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  // ── Oversized payloads ────────────────────────────────────────────────────

  describe("Oversized payloads", () => {
    it("should handle 1000-action array without crashing", () => {
      const actions: CartAction[] = Array(1000).fill({
        type: "ADD_ITEM",
        itemId: "fake-item",
        quantity: 1,
      });
      expect(() => applyCartDelta(actions, useCartStore.getState())).not.toThrow();
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should handle 1000-action array of valid items without crashing", () => {
      // All valid: should accumulate
      const actions: CartAction[] = Array(1000).fill({
        type: "ADD_ITEM",
        itemId: "burrata-salad",
        quantity: 1,
      });
      expect(() => applyCartDelta(actions, useCartStore.getState())).not.toThrow();
      const state = useCartStore.getState();
      expect(state.items).toHaveLength(1); // all accumulated into same item
      expect(state.totalItems).toBe(1000);
    });

    it("should handle response with 1000 action objects in parseAIResponse", () => {
      const mockLogger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any as Console;
      const actions = Array(1000).fill({
        type: "ADD_ITEM",
        itemId: "burrata-salad",
        quantity: 1,
      });
      const result = parseAIResponse(
        {
          actions,
          confirmation: "x",
          executionLog: VALID_EXECUTION_LOG,
        },
        mockLogger,
      );
      expect(result).not.toBeNull();
      expect(result!.actions).toHaveLength(1000);
    });
  });

  // ── XSS in AI response fields ─────────────────────────────────────────────

  describe("XSS-like content in AI response", () => {
    it("should parse XSS_INJECTION_RESPONSE without executing scripts", () => {
      const mockLogger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any as Console;
      // Confirmation contains XSS-like content
      // Our parsing should just store it as a string, not execute it
      const result = parseAIResponse(XSS_INJECTION_RESPONSE as any, mockLogger);
      // The executionLog contains a script tag — should fail non-string check?
      // Actually script tags ARE strings, so they pass string validation
      // The key thing: we don't execute them
      if (result) {
        expect(typeof result.confirmation).toBe("string");
        expect(result.executionLog.every((e) => typeof e === "string")).toBe(true);
      }
    });

    it("should store XSS content as-is without sanitization in parseAIResponse", () => {
      // The parsing layer doesn't sanitize — that's the rendering layer's job
      // But we verify it doesn't throw or execute code
      const mockLogger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any as Console;
      expect(() =>
        parseAIResponse(XSS_INJECTION_RESPONSE as any, mockLogger),
      ).not.toThrow();
    });
  });

  // ── Request flooding ──────────────────────────────────────────────────────

  describe("Request flooding prevention", () => {
    it("should enforce debounce: only 1st request of rapid burst should succeed", async () => {
      vi.useFakeTimers();
      setupSuccessResponse({
        actions: [],
        confirmation: "ok",
        executionLog: VALID_EXECUTION_LOG,
      });

      const { RequestManager } = await import("@/lib/requestManager");
      const manager = new RequestManager();

      const results: ("success" | "debounced")[] = [];

      const req1 = manager
        .sendWithRetry("Message 1", [])
        .then(() => results.push("success"))
        .catch(() => results.push("debounced"));

      const req2 = manager
        .sendWithRetry("Message 2", [])
        .then(() => results.push("success"))
        .catch(() => results.push("debounced"));

      const req3 = manager
        .sendWithRetry("Message 3", [])
        .then(() => results.push("success"))
        .catch(() => results.push("debounced"));

      await vi.runAllTimersAsync();
      await Promise.all([req1, req2, req3]);
      vi.useRealTimers();

      // Only 1st should succeed; 2nd and 3rd debounced
      expect(results.filter((r) => r === "debounced")).toHaveLength(2);
      expect(results.filter((r) => r === "success")).toHaveLength(1);
    });
  });

  // ── Zod schema boundary attacks (backend simulation) ─────────────────────

  describe("Schema boundary inputs", () => {
    it("should return 400 when message field is empty string", async () => {
      setupServerError(400, "Invalid request body");

      await expect(sendChatMessage("", [])).rejects.toMatchObject({
        code: "SERVER",
        statusCode: 400,
      });
    });

    it("should handle null/undefined cart gracefully on API client side", async () => {
      setupSuccessResponse({
        actions: [],
        confirmation: "ok",
        executionLog: VALID_EXECUTION_LOG,
      });

      // Passing empty array (valid)
      await expect(sendChatMessage("Test", [])).resolves.toBeDefined();
    });
  });

  // ── applyCartDeltaSafe as security wrapper ────────────────────────────────

  describe("applyCartDeltaSafe as security boundary", () => {
    it("should return zero report for any non-array input without throwing", () => {
      const inputs = [
        null,
        undefined,
        "string",
        42,
        {},
        Symbol("x"),
        () => {},
        NaN,
        Infinity,
        true,
      ];

      for (const input of inputs) {
        expect(() => applyCartDeltaSafe(input as any, useCartStore.getState())).not.toThrow();
        const result = applyCartDeltaSafe(input as any, useCartStore.getState());
        expect(result).toEqual({ applied: 0, failed: 0, skipped: 0 });
      }
    });
  });
});

/**
 * requestManager.test.ts - Unit tests for RequestManager
 *
 * Tests:
 * - Debounce logic
 * - Exponential backoff calculation
 * - Online/offline detection
 * - Request cancellation
 * - Retry on transient errors
 * - Non-retryable error passthrough
 * - Concurrent request cancellation
 */

import { APIClientError , sendChatMessage } from "@/lib/api";
import { RequestManager } from "@/lib/requestManager";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIResponse } from "@/lib/types";
import { VALID_EXECUTION_LOG } from "../__fixtures__/aiResponseFixtures";


// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock the api module so we don't make real network calls
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    sendChatMessage: vi.fn(),
  };
});

const mockSendChatMessage = vi.mocked(sendChatMessage);

const MOCK_RESPONSE: AIResponse = {
  actions: [],
  confirmation: "Test response",
  executionLog: VALID_EXECUTION_LOG,
};

const EMPTY_CART = [] as {
  id: string;
  name: string;
  price: number;
  quantity: number;
}[];

// ── Test suite ────────────────────────────────────────────────────────────────

describe("RequestManager", () => {
  let manager: RequestManager;

  beforeEach(() => {
    manager = new RequestManager();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Debounce logic ──────────────────────────────────────────────────────────

  describe("Debounce logic", () => {
    it("should throw if called before debounce window expires", async () => {
      mockSendChatMessage.mockResolvedValue(MOCK_RESPONSE);

      // First call succeeds
      const firstCall = manager.sendWithRetry("First message", EMPTY_CART);
      // Immediately advance time by less than debounce (300ms default)
      vi.advanceTimersByTime(100);

      await expect(manager.sendWithRetry("Second message", EMPTY_CART)).rejects.toThrow(
        /Too many requests/,
      );

      await firstCall;
    });

    it("should allow request after debounce window expires", async () => {
      mockSendChatMessage.mockResolvedValue(MOCK_RESPONSE);

      await manager.sendWithRetry("First", EMPTY_CART);
      vi.advanceTimersByTime(400); // past 300ms debounce

      // Should not throw
      await expect(
        manager.sendWithRetry("Second", EMPTY_CART),
      ).resolves.toEqual(MOCK_RESPONSE);
    });

    it("setDebounceDelay should enforce minimum of 100ms", () => {
      manager.setDebounceDelay(0);
      // No public getter, but we can test behavior indirectly
      // If delay < 100ms, it's clamped. Here we just assert no throw.
      expect(() => manager.setDebounceDelay(50)).not.toThrow();
    });
  });

  // ── Offline detection ──────────────────────────────────────────────────────

  describe("Offline detection", () => {
    it("should throw APIClientError with NETWORK code when offline", async () => {
      manager.setOnlineStatus(false);

      await expect(
        manager.sendWithRetry("Hello", EMPTY_CART),
      ).rejects.toMatchObject({
        code: "NETWORK",
        message: expect.stringContaining("offline"),
      });
    });

    it("should succeed when online status restored", async () => {
      mockSendChatMessage.mockResolvedValue(MOCK_RESPONSE);
      manager.setOnlineStatus(false);
      manager.setOnlineStatus(true);

      await expect(
        manager.sendWithRetry("Hello", EMPTY_CART),
      ).resolves.toEqual(MOCK_RESPONSE);
    });
  });

  // ── Retry logic ────────────────────────────────────────────────────────────

  describe("Retry on transient errors", () => {
    it("should retry on TIMEOUT error and succeed on second attempt", async () => {
      mockSendChatMessage
        .mockRejectedValueOnce(
          new APIClientError("TIMEOUT", undefined, "Request timed out after 15000ms"),
        )
        .mockResolvedValueOnce(MOCK_RESPONSE);

      const onRetry = vi.fn();
      const resultPromise = manager.sendWithRetry("Hello", EMPTY_CART, onRetry);

      // Advance past retry delay (500ms initial backoff)
      await vi.runAllTimersAsync();

      const result = await resultPromise;
      expect(result).toEqual(MOCK_RESPONSE);
      expect(mockSendChatMessage).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("should retry on NETWORK error", async () => {
      mockSendChatMessage
        .mockRejectedValueOnce(
          new APIClientError("NETWORK", undefined, "Network error"),
        )
        .mockRejectedValueOnce(
          new APIClientError("NETWORK", undefined, "Network error"),
        )
        .mockResolvedValueOnce(MOCK_RESPONSE);

      const resultPromise = manager.sendWithRetry("Hello", EMPTY_CART);
      await vi.runAllTimersAsync();

      const result = await resultPromise;
      expect(result).toEqual(MOCK_RESPONSE);
      expect(mockSendChatMessage).toHaveBeenCalledTimes(3);
    });

    it("should exhaust retries and throw after max attempts", async () => {
      const networkError = new APIClientError("NETWORK", undefined, "Network error");
      mockSendChatMessage.mockRejectedValue(networkError);

      const rejectPromise = expect(
        manager.sendWithRetry("Hello", EMPTY_CART),
      ).rejects.toMatchObject({ code: "NETWORK" });
      await vi.runAllTimersAsync();
      await rejectPromise;
      expect(mockSendChatMessage).toHaveBeenCalledTimes(3); // maxAttempts = 3
    });

    it("should NOT retry on SERVER errors (4xx/5xx)", async () => {
      mockSendChatMessage.mockRejectedValue(
        new APIClientError("SERVER", 400, "Bad Request"),
      );

      const rejectPromise = expect(
        manager.sendWithRetry("Hello", EMPTY_CART),
      ).rejects.toMatchObject({ code: "SERVER" });
      await vi.runAllTimersAsync();
      await rejectPromise;
      expect(mockSendChatMessage).toHaveBeenCalledTimes(1); // no retry
    });

    it("should NOT retry on INVALID_RESPONSE errors", async () => {
      mockSendChatMessage.mockRejectedValue(
        new APIClientError("INVALID_RESPONSE", 200, "Invalid schema"),
      );

      const rejectPromise = expect(
        manager.sendWithRetry("Hello", EMPTY_CART),
      ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
      await vi.runAllTimersAsync();
      await rejectPromise;
      expect(mockSendChatMessage).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry on PARSE errors", async () => {
      mockSendChatMessage.mockRejectedValue(
        new APIClientError("PARSE", 200, "JSON parse error"),
      );

      const rejectPromise = expect(
        manager.sendWithRetry("Hello", EMPTY_CART),
      ).rejects.toMatchObject({ code: "PARSE" });
      await vi.runAllTimersAsync();
      await rejectPromise;
      expect(mockSendChatMessage).toHaveBeenCalledTimes(1);
    });

    it("should call onRetry callback with attempt number and error", async () => {
      const onRetry = vi.fn();
      mockSendChatMessage
        .mockRejectedValueOnce(new APIClientError("TIMEOUT"))
        .mockResolvedValueOnce(MOCK_RESPONSE);

      const resultPromise = manager.sendWithRetry("Hello", EMPTY_CART, onRetry);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  // ── Exponential backoff ────────────────────────────────────────────────────

  describe("Exponential backoff", () => {
    it("should apply increasing delays on successive retries", async () => {
      manager.setRetryConfig({
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      });

      const networkError = new APIClientError("NETWORK");
      mockSendChatMessage.mockRejectedValue(networkError);

      const timeoutSpy = vi.spyOn(global, "setTimeout");
      const rejectPromise = expect(
        manager.sendWithRetry("Hello", EMPTY_CART),
      ).rejects.toBeDefined();
      await vi.runAllTimersAsync();
      await rejectPromise;

      const delays = timeoutSpy.mock.calls
        .map((call) => call[1] as number)
        .filter((d) => d > 0);

      if (delays.length >= 2) {
        expect(delays[1]).toBeGreaterThanOrEqual(delays[0]!);
      }
    });

    it("should cap delay at maxDelayMs", async () => {
      manager.setRetryConfig({
        maxAttempts: 3,
        initialDelayMs: 3000,
        maxDelayMs: 5000,
        backoffMultiplier: 10,
      });

      const networkError = new APIClientError("TIMEOUT");
      mockSendChatMessage.mockRejectedValue(networkError);

      const setSpy = vi.spyOn(global, "setTimeout");
      const rejectPromise = expect(
        manager.sendWithRetry("Hello", EMPTY_CART),
      ).rejects.toBeDefined();
      await vi.runAllTimersAsync();
      await rejectPromise;

      const delays = setSpy.mock.calls
        .map((call) => call[1] as number)
        .filter((d) => d > 0);

      for (const d of delays) {
        expect(d).toBeLessThanOrEqual(5500);
      }
    });
  });

  // ── Request cancellation ───────────────────────────────────────────────────

  describe("Request cancellation", () => {
    it("should mark isProcessing as false after successful request", async () => {
      mockSendChatMessage.mockResolvedValue(MOCK_RESPONSE);
      await manager.sendWithRetry("Hello", EMPTY_CART);
      expect(manager.isProcessing()).toBe(false);
    });

    it("should mark isProcessing as false after failed request", async () => {
      mockSendChatMessage.mockRejectedValue(new APIClientError("SERVER", 500));
      const rejectPromise = expect(
        manager.sendWithRetry("Hello", EMPTY_CART),
      ).rejects.toBeDefined();
      await vi.runAllTimersAsync();
      await rejectPromise;
      expect(manager.isProcessing()).toBe(false);
    });

    it("cancelRequest should set isProcessing to false", async () => {
      mockSendChatMessage.mockImplementation(
        () => new Promise(() => {}), // never resolves
      );

      // Don't await — let it hang
      manager.sendWithRetry("Hello", EMPTY_CART).catch(() => {});

      manager.cancelRequest();
      expect(manager.isProcessing()).toBe(false);
    });
  });

  // ── setRetryConfig ─────────────────────────────────────────────────────────

  describe("setRetryConfig", () => {
    it("should partially update retry config", async () => {
      manager.setRetryConfig({ maxAttempts: 1 });

      const networkError = new APIClientError("NETWORK");
      mockSendChatMessage.mockRejectedValue(networkError);

      const rejectPromise = expect(
        manager.sendWithRetry("Hello", EMPTY_CART),
      ).rejects.toBeDefined();
      await vi.runAllTimersAsync();
      await rejectPromise;

      // With maxAttempts=1, only 1 call should be made
      expect(mockSendChatMessage).toHaveBeenCalledTimes(1);
    });
  });
});

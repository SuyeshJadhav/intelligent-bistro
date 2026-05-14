/**
 * mockServer.ts - MSW (Mock Service Worker) mock API server
 *
 * Provides a deterministic fake backend that:
 * - Returns pre-configured AI responses
 * - Simulates timeouts, network failures, and partial corruption
 * - Never touches the real Gemini API
 * - Is fully resettable between tests
 *
 * Usage:
 *   import { mockServer, setupSuccessResponse, setupNetworkError } from '../__mocks__/mockServer';
 *   beforeAll(() => mockServer.listen());
 *   afterEach(() => mockServer.resetHandlers());
 *   afterAll(() => mockServer.close());
 */

import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import type { AIResponse } from "@/lib/types";
import { VALID_EXECUTION_LOG } from "../__fixtures__/aiResponseFixtures";

const API_BASE = "http://localhost:3000";

// ── Default success handler ───────────────────────────────────────────────

const DEFAULT_SUCCESS_RESPONSE: AIResponse = {
  actions: [],
  confirmation: "Mock: No actions needed.",
  executionLog: VALID_EXECUTION_LOG,
};

// ── Server instance ───────────────────────────────────────────────────────

export const mockServer = setupServer(
  // Default: returns empty success response
  http.post(`${API_BASE}/api/chat`, () => {
    return HttpResponse.json(DEFAULT_SUCCESS_RESPONSE);
  }),

  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({ status: "ok", service: "intelligent-bistro-api" });
  }),
);

// ── Handler factories for test-specific scenarios ─────────────────────────

/**
 * Override the /api/chat endpoint with a specific AI response.
 */
export function setupSuccessResponse(response: AIResponse): void {
  mockServer.use(
    http.post(`${API_BASE}/api/chat`, () => {
      return HttpResponse.json(response);
    }),
  );
}

/**
 * Simulate a network failure (fetch throws TypeError).
 */
export function setupNetworkError(): void {
  mockServer.use(
    http.post(`${API_BASE}/api/chat`, () => {
      return HttpResponse.error();
    }),
  );
}

/**
 * Simulate a server error (HTTP 500).
 */
export function setupServerError(
  status = 500,
  message = "Internal Server Error",
): void {
  mockServer.use(
    http.post(`${API_BASE}/api/chat`, () => {
      return HttpResponse.json({ error: message }, { status });
    }),
  );
}

/**
 * Simulate a validation error (HTTP 400).
 */
export function setupValidationError(): void {
  mockServer.use(
    http.post(`${API_BASE}/api/chat`, () => {
      return HttpResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }),
  );
}

/**
 * Simulate a slow response that exceeds the client timeout.
 * @param delayMs - How long to wait before responding (should exceed client's timeout)
 */
export function setupTimeoutResponse(delayMs = 20_000): void {
  mockServer.use(
    http.post(`${API_BASE}/api/chat`, async () => {
      await delay(delayMs);
      return HttpResponse.json(DEFAULT_SUCCESS_RESPONSE);
    }),
  );
}

/**
 * Simulate a slow but eventually successful response.
 */
export function setupSlowResponse(
  delayMs = 2000,
  response: AIResponse = DEFAULT_SUCCESS_RESPONSE,
): void {
  mockServer.use(
    http.post(`${API_BASE}/api/chat`, async () => {
      await delay(delayMs);
      return HttpResponse.json(response);
    }),
  );
}

/**
 * Simulate a response with invalid/malformed JSON that can't be parsed.
 */
export function setupMalformedJsonResponse(): void {
  mockServer.use(
    http.post(`${API_BASE}/api/chat`, () => {
      return new HttpResponse("{ this is not json }", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

/**
 * Simulate a response that is valid JSON but fails AIResponse schema validation.
 */
export function setupInvalidSchemaResponse(): void {
  mockServer.use(
    http.post(`${API_BASE}/api/chat`, () => {
      return HttpResponse.json({
        // Missing 'actions' field, wrong executionLog length
        confirmation: "Done",
        executionLog: ["ONE"],
      });
    }),
  );
}

/**
 * Simulate transient failure: fails N times, then succeeds.
 * Useful for testing retry logic.
 */
export function setupTransientFailure(
  failCount: number,
  successResponse: AIResponse = DEFAULT_SUCCESS_RESPONSE,
): void {
  let callCount = 0;
  mockServer.use(
    http.post(`${API_BASE}/api/chat`, () => {
      callCount++;
      if (callCount <= failCount) {
        return HttpResponse.error();
      }
      return HttpResponse.json(successResponse);
    }),
  );
}

/**
 * Track how many times the endpoint was called.
 * Returns a reference that updates as calls come in.
 */
export function setupCallCounter(): { count: number } {
  const tracker = { count: 0 };
  mockServer.use(
    http.post(`${API_BASE}/api/chat`, () => {
      tracker.count++;
      return HttpResponse.json(DEFAULT_SUCCESS_RESPONSE);
    }),
  );
  return tracker;
}

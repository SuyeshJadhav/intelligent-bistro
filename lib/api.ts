/**
 * Production-grade API client for the Intelligent Bistro.
 *
 * Features:
 * - Environment-based configuration
 * - Strong TypeScript types
 * - Timeout handling
 * - Clean async/await error handling
 * - Request/response validation
 * - Defensive parsing
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

import { parseAIResponse } from "./defensiveParsing";
import type { AIResponse, APIError, ChatRequest } from "./types";

// Configuration
const DEFAULT_API_BASE_URL = "http://localhost:3000";
const IS_DEV_RUNTIME =
  typeof globalThis !== "undefined" &&
  "__DEV__" in globalThis &&
  Boolean((globalThis as { __DEV__?: boolean }).__DEV__);

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizeBaseUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !isHttpUrl(trimmed)) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}

function getApiBaseUrls(): string[] {
  const configuredUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);
  if (configuredUrl) {
    // If explicitly configured, do not fall back to emulator/localhost URLs.
    return [configuredUrl];
  }

  const baseUrls: string[] = [];

  if (Platform.OS === "android" && !Constants.isDevice) {
    baseUrls.push("http://10.0.2.2:3000");
  }

  baseUrls.push(DEFAULT_API_BASE_URL);

  return Array.from(new Set(baseUrls));
}

const DEFAULT_TIMEOUT_MS = 15000; // 15 seconds for natural language processing

/**
 * Custom error class for API failures.
 */
export class APIClientError extends Error {
  constructor(
    public code:
      | "TIMEOUT"
      | "NETWORK"
      | "PARSE"
      | "INVALID_RESPONSE"
      | "SERVER",
    public statusCode?: number,
    message?: string,
  ) {
    super(message || code);
    this.name = "APIClientError";
  }
}

/**
 * Creates an AbortSignal that times out after the specified duration.
 */
function createTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal;
  timeoutId: ReturnType<typeof setTimeout>;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeoutId };
}

/**
 * Sends a natural language message to the backend and returns structured cart actions.
 *
 * @param message - User's natural language input (e.g., "Add two spicy chicken sandwiches")
 * @param cartState - Current cart items for context
 * @param timeoutMs - Request timeout in milliseconds (default: 15000ms)
 * @returns AI response with validated actions and execution feedback
 *
 * @throws APIClientError with specific error codes:
 *   - "TIMEOUT": Request exceeded timeoutMs
 *   - "NETWORK": Fetch failed (no internet, CORS, etc.)
 *   - "INVALID_RESPONSE": Response body doesn't match AIResponse schema
 *   - "SERVER": HTTP 4xx/5xx error from backend
 *   - "PARSE": JSON parsing failure
 */
export async function sendChatMessage(
  message: string,
  cartState: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<AIResponse> {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_URL;
  const candidateBaseUrls = getApiBaseUrls();

  if (IS_DEV_RUNTIME) {
    console.log("[API DEBUG][ENV]", envBaseUrl);
    console.log("[API DEBUG][BASE URLS]", candidateBaseUrls);
  }

  const payload: ChatRequest = {
    message,
    cart: cartState,
  };

  let lastNetworkError: Error | null = null;
  let firstNetworkError: Error | null = null;

  for (const baseUrl of candidateBaseUrls) {
    const { signal, timeoutId } = createTimeoutSignal(timeoutMs);
    const requestUrl = `${baseUrl}/api/chat`;

    if (IS_DEV_RUNTIME) {
      console.log("[API DEBUG][FETCH URL]", requestUrl);
    }

    try {
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal,
      });

      // Handle HTTP errors
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;

        try {
          const errorData = (await response.json()) as APIError;
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Fall back to generic HTTP error message
        }

        throw new APIClientError("SERVER", response.status, errorMessage);
      }

      // Parse response JSON
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new APIClientError(
          "PARSE",
          response.status,
          "Failed to parse JSON response",
        );
      }

      // Validate response shape using defensive parser
      const parsedResponse = parseAIResponse(data);
      if (!parsedResponse) {
        throw new APIClientError(
          "INVALID_RESPONSE",
          response.status,
          "Response does not match AIResponse schema",
        );
      }

      return parsedResponse;
    } catch (error) {
      if (IS_DEV_RUNTIME) {
        console.log("[API DEBUG][FETCH ERROR URL]", requestUrl);
        console.log(
          "[API DEBUG][FETCH ERROR DETAILS]",
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : { value: String(error) },
        );
      }

      if (error instanceof APIClientError) {
        if (error.code !== "NETWORK") {
          throw error;
        }

        lastNetworkError = error;
        if (!firstNetworkError) {
          firstNetworkError = error;
        }
      } else if (error instanceof Error && error.name === "AbortError") {
        const timeoutError = new APIClientError(
          "TIMEOUT",
          undefined,
          `Request timed out after ${timeoutMs}ms`,
        );
        lastNetworkError = timeoutError;
        if (!firstNetworkError) {
          firstNetworkError = timeoutError;
        }
      } else if (error instanceof TypeError) {
        const networkError = new APIClientError(
          "NETWORK",
          undefined,
          `Network error: ${error.message}`,
        );
        lastNetworkError = networkError;
        if (!firstNetworkError) {
          firstNetworkError = networkError;
        }
      } else {
        const unknownNetworkError = new APIClientError(
          "NETWORK",
          undefined,
          error instanceof Error ? error.message : "Unknown error",
        );
        lastNetworkError = unknownNetworkError;
        if (!firstNetworkError) {
          firstNetworkError = unknownNetworkError;
        }
      }
    } finally {
      // Clean up timeout
      clearTimeout(timeoutId);
    }
  }

  throw (
    firstNetworkError ||
    lastNetworkError ||
    new APIClientError(
      "NETWORK",
      undefined,
      "Network error: unable to reach backend",
    )
  );
}

/**
 * Health check endpoint to verify backend is reachable.
 */
export async function healthCheck(): Promise<boolean> {
  for (const baseUrl of getApiBaseUrls()) {
    const requestUrl = `${baseUrl}/health`;

    if (IS_DEV_RUNTIME) {
      console.log("[API DEBUG][HEALTH URL]", requestUrl);
    }

    try {
      const response = await fetch(requestUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return true;
      }
    } catch {
      // Try the next candidate base URL.
    }
  }

  return false;
}

/**
 * Strips down full CartItem objects to the minimal payload required by the backend.
 */
export function toCartPayload(cartState: any[]): ChatRequest["cart"] {
  return cartState.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  }));
}

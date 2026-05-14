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

import type { AIResponse, APIError, ChatRequest } from "./types";
import { parseAIResponse } from "./defensiveParsing";

// Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

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
  const { signal, timeoutId } = createTimeoutSignal(timeoutMs);

  try {
    const endpoint = `${API_BASE_URL}/api/chat`;

    const payload: ChatRequest = {
      message,
      cart: cartState,
    };

    const response = await fetch(endpoint, {
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
    // Re-throw our custom errors
    if (error instanceof APIClientError) {
      throw error;
    }

    // Handle abort signal (timeout)
    if (error instanceof Error && error.name === "AbortError") {
      throw new APIClientError(
        "TIMEOUT",
        undefined,
        `Request timed out after ${timeoutMs}ms`,
      );
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new APIClientError(
        "NETWORK",
        undefined,
        `Network error: ${error.message}`,
      );
    }

    // Unknown error
    throw new APIClientError(
      "NETWORK",
      undefined,
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    // Clean up timeout
    clearTimeout(timeoutId);
  }
}

/**
 * Health check endpoint to verify backend is reachable.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
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

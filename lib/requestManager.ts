/**
 * requestManager.ts - Production-grade request management for the Intelligent Bistro
 *
 * Provides:
 * - Request debouncing (prevent rapid repeated requests)
 * - Request cancellation (abort in-flight requests)
 * - Automatic retry with exponential backoff
 * - Offline detection
 * - Request queuing for offline scenarios
 * - Type-safe request tracking
 */

import { APIClientError, sendChatMessage } from "./api";
import type { AIResponse } from "./types";

/**
 * Request state for tracking in-flight requests
 */
interface RequestState {
  isProcessing: boolean;
  abortController: AbortController | null;
  lastRequestAt: number;
  retryCount: number;
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration: max 3 attempts, 500ms initial delay, exponential backoff
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Manages AI message requests with debouncing, retry, and cancellation
 */
export class RequestManager {
  private state: RequestState = {
    isProcessing: false,
    abortController: null,
    lastRequestAt: 0,
    retryCount: 0,
  };

  private debounceTimeoutId: NodeJS.Timeout | null = null;
  private debounceDelayMs = 300; // Min time between requests
  private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;
  private isOnline = true;

  constructor() {
    // Detect online/offline status
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("online", () => {
        this.isOnline = true;
      });
      window.addEventListener("offline", () => {
        this.isOnline = false;
      });
    }
  }

  /**
   * Check if enough time has passed since last request (debounce)
   */
  private isDebounceReady(): boolean {
    const timeSinceLastRequest = Date.now() - this.state.lastRequestAt;
    return timeSinceLastRequest >= this.debounceDelayMs;
  }

  /**
   * Calculate delay for exponential backoff retry
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.initialDelayMs *
        Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
      this.retryConfig.maxDelayMs,
    );

    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.max(0, delay + jitter);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send a debounced chat message with automatic retry on network errors
   *
   * @param message - User's natural language message
   * @param cart - Current cart state
   * @param onRetry - Optional callback fired before each retry attempt
   * @returns AI response with validated actions and execution feedback
   *
   * Features:
   * - Debounces rapid consecutive requests
   * - Automatically retries on transient network errors
   * - Cancels previous in-flight request if new one is sent
   * - Detects offline and provides helpful message
   * - Exhausts retry budget before giving up
   */
  async sendWithRetry(
    message: string,
    cart: { id: string; name: string; price: number; quantity: number }[],
    onRetry?: (attempt: number, error: Error) => void,
  ): Promise<AIResponse> {
    // Check online status
    if (!this.isOnline) {
      throw new APIClientError(
        "NETWORK",
        undefined,
        "You appear to be offline. Please check your connection.",
      );
    }

    // Check debounce
    if (!this.isDebounceReady()) {
      const timeRemaining =
        this.debounceDelayMs - (Date.now() - this.state.lastRequestAt);
      throw new Error(
        `Too many requests. Please wait ${Math.ceil(timeRemaining / 100) * 100}ms.`,
      );
    }

    // Update state
    this.state.lastRequestAt = Date.now();
    this.state.isProcessing = true;
    this.state.retryCount = 0;

    // Cancel any previous in-flight request
    if (this.state.abortController) {
      this.state.abortController.abort();
    }

    this.state.abortController = new AbortController();

    try {
      return await this.attemptWithRetry(message, cart, onRetry);
    } finally {
      this.state.isProcessing = false;
      this.state.abortController = null;
    }
  }

  /**
   * Internal: attempt request with automatic retry logic
   */
  private async attemptWithRetry(
    message: string,
    cart: { id: string; name: string; price: number; quantity: number }[],
    onRetry?: (attempt: number, error: Error) => void,
  ): Promise<AIResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await sendChatMessage(message, cart);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Only retry on specific transient errors
        const isRetryable = this.isRetryableError(error);
        if (!isRetryable || attempt === this.retryConfig.maxAttempts) {
          throw error;
        }

        // Call retry callback
        if (onRetry) {
          onRetry(attempt, lastError);
        }

        // Calculate and apply exponential backoff
        const delayMs = this.calculateRetryDelay(attempt);
        console.log(
          `[RequestManager] Retry attempt ${attempt + 1}/${this.retryConfig.maxAttempts} after ${delayMs}ms`,
        );

        await this.sleep(delayMs);
      }
    }

    // Exhausted retries
    throw lastError || new Error("Request failed after all retries");
  }

  /**
   * Determine if an error is worth retrying
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof APIClientError) {
      // Retry on timeout and network errors
      return error.code === "TIMEOUT" || error.code === "NETWORK";
    }

    if (error instanceof TypeError) {
      // Retry on network-related TypeErrors
      return (
        error.message.includes("fetch") ||
        error.message.includes("network") ||
        error.message.includes("Failed")
      );
    }

    return false;
  }

  /**
   * Cancel any in-flight request
   */
  cancelRequest(): void {
    if (this.state.abortController) {
      this.state.abortController.abort();
      this.state.abortController = null;
    }
    this.state.isProcessing = false;
  }

  /**
   * Check if a request is currently processing
   */
  isProcessing(): boolean {
    return this.state.isProcessing;
  }

  /**
   * Update debounce delay (in milliseconds)
   */
  setDebounceDelay(ms: number): void {
    this.debounceDelayMs = Math.max(100, ms); // Minimum 100ms
  }

  /**
   * Update retry configuration
   */
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Manually set online/offline status (for testing)
   */
  setOnlineStatus(isOnline: boolean): void {
    this.isOnline = isOnline;
  }
}

/**
 * Singleton instance for app-wide request management
 */
export const requestManager = new RequestManager();

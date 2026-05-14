/**
 * Shared types between frontend and backend for API communication.
 * These types are derived from the backend's Zod validation schemas.
 */

export type CartActionType = "ADD_ITEM" | "REMOVE_ITEM" | "UPDATE_QUANTITY";

export interface CartAction {
  type: CartActionType;
  itemId: string;
  quantity?: number;
}

/**
 * The strict JSON response from the Gemini AI via the backend.
 * Guaranteed to have exactly 4 execution log entries.
 */
export interface AIResponse {
  actions: CartAction[];
  confirmation: string;
  executionLog: [string, string, string, string];
}

/**
 * Request payload for POST /api/chat
 */
export interface ChatRequest {
  message: string;
  cart: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
}

/**
 * Error response from the API.
 */
export interface APIError {
  error: string;
}

/**
 * Response type from sendChatMessage.
 */
export type ChatResponse = AIResponse | { error: string };

/**
 * Shared types between frontend and backend for API communication.
 * These types are derived from the backend's Zod validation schemas.
 */

export type CartActionType = "ADD_ITEM" | "REMOVE_ITEM" | "UPDATE_QUANTITY";

export interface CartAction {
  type: CartActionType;
  itemId: string;
  quantity?: number;
  modifiers?: Modifier[];
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

// Optional clarification choices returned by the backend when resolution is ambiguous
export interface ClarificationChoice {
  raw: string;
  resolvedId?: string | null;
  label?: string | null;
  confidence?: number | null;
}

export interface AIResponseWithClarification extends AIResponse {
  clarificationChoices?: ClarificationChoice[];
}

// New: structured modifier type
export interface Modifier {
  type: string; // e.g. "ingredient_removal", "spice_level", "dressing_side"
  value: string; // e.g. "onions", "extra_spicy", "on_side"
}

// Candidate returned by the resolver
export interface MatchCandidate {
  raw: string;
  resolvedId: string;
  label: string;
  score: number; // internal fuzzy score (lower = better)
  confidence: number; // 0..1 (higher = better)
  spanStart: number;
  spanEnd: number; // exclusive
}

export interface ResolveResult {
  resolvedText: string;
  matches: MatchCandidate[];
}

// Normalized intent target: raw + resolved id + confidence
export interface IntentTarget {
  raw: string;
  resolvedId?: string;
  label?: string;
  confidence?: number;
  modifiers?: Modifier[];
}

export interface IntentGraph {
  intent: string; // e.g. "ADD"
  targets: IntentTarget[];
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

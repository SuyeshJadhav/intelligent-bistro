/**
 * aiResponseFixtures.ts - Reusable AI response shapes for mocking Gemini
 *
 * Covers: valid responses, partial corruption, hallucinations, edge cases
 */

import type { AIResponse } from "@/lib/types";

// ── Valid responses ──────────────────────────────────────────────────────────

export const VALID_EXECUTION_LOG: [string, string, string, string] = [
  "PROCESSING_INTENT...",
  "VALIDATING_MENU...",
  "UPDATING_STATE...",
  "SYNC_COMPLETE",
];

export const NO_MATCH_EXECUTION_LOG: [string, string, string, string] = [
  "PROCESSING_INTENT...",
  "VALIDATING_MENU...",
  "NO_MATCH_FOUND",
  "AWAITING_INPUT...",
];

export function makeAddItemResponse(
  itemId: string,
  quantity: number,
  confirmation = `Added ${quantity}x ${itemId} to your cart.`,
): AIResponse {
  return {
    actions: [{ type: "ADD_ITEM", itemId, quantity }],
    confirmation,
    executionLog: VALID_EXECUTION_LOG,
  };
}

export function makeRemoveItemResponse(
  itemId: string,
  confirmation = `Removed ${itemId} from your cart.`,
): AIResponse {
  return {
    actions: [{ type: "REMOVE_ITEM", itemId }],
    confirmation,
    executionLog: VALID_EXECUTION_LOG,
  };
}

export function makeUpdateQuantityResponse(
  itemId: string,
  quantity: number,
  confirmation = `Updated ${itemId} quantity to ${quantity}.`,
): AIResponse {
  return {
    actions: [{ type: "UPDATE_QUANTITY", itemId, quantity }],
    confirmation,
    executionLog: VALID_EXECUTION_LOG,
  };
}

export const EMPTY_ACTION_RESPONSE: AIResponse = {
  actions: [],
  confirmation: "I couldn't find that item on our menu.",
  executionLog: NO_MATCH_EXECUTION_LOG,
};

export const MULTI_ACTION_RESPONSE: AIResponse = {
  actions: [
    { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
    { type: "ADD_ITEM", itemId: "tagliatelle", quantity: 2 },
    { type: "ADD_ITEM", itemId: "yuzu-spritz", quantity: 2 },
  ],
  confirmation: "Added a starter, 2 tagliatelle, and 2 drinks.",
  executionLog: VALID_EXECUTION_LOG,
};

// ── Malformed / corrupted responses ─────────────────────────────────────────

export const MALFORMED_JSON_STRING = "{ this is not json }";

export const MALFORMED_MISSING_ACTIONS = {
  // actions field missing entirely
  confirmation: "Done",
  executionLog: VALID_EXECUTION_LOG,
};

export const MALFORMED_WRONG_EXECUTION_LOG_LENGTH = {
  actions: [],
  confirmation: "Done",
  executionLog: ["ONLY_ONE_ENTRY"], // should be 4
};

export const MALFORMED_NON_STRING_LOG_ENTRIES = {
  actions: [],
  confirmation: "Done",
  executionLog: [1, null, true, {}], // non-string entries
};

export const HALLUCINATED_ITEM_RESPONSE: AIResponse = {
  actions: [
    { type: "ADD_ITEM", itemId: "pizza-margherita", quantity: 1 }, // not on menu
    { type: "ADD_ITEM", itemId: "cheesecake", quantity: 2 }, // not on menu
  ],
  confirmation: "Added pizza and cheesecake.",
  executionLog: VALID_EXECUTION_LOG,
};

export const EXTREME_QUANTITY_RESPONSE: AIResponse = {
  actions: [{ type: "ADD_ITEM", itemId: "burrata-salad", quantity: 999 }],
  confirmation: "Added 999 burrata salads.",
  executionLog: VALID_EXECUTION_LOG,
};

export const ZERO_QUANTITY_ADD_RESPONSE = {
  actions: [{ type: "ADD_ITEM", itemId: "burrata-salad", quantity: 0 }],
  confirmation: "Added 0.",
  executionLog: VALID_EXECUTION_LOG,
};

export const FRACTIONAL_QUANTITY_RESPONSE = {
  actions: [{ type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1.5 }],
  confirmation: "Added 1.5.",
  executionLog: VALID_EXECUTION_LOG,
};

export const DUPLICATE_ACTIONS_RESPONSE: AIResponse = {
  actions: [
    { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
    { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 }, // duplicate
  ],
  confirmation: "Added burrata salad twice.",
  executionLog: VALID_EXECUTION_LOG,
};

export const CONFLICTING_ACTIONS_RESPONSE: AIResponse = {
  actions: [
    { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 2 },
    { type: "REMOVE_ITEM", itemId: "burrata-salad" }, // immediately removes it
  ],
  confirmation: "Added then removed burrata.",
  executionLog: VALID_EXECUTION_LOG,
};

export const DEEPLY_NESTED_CORRUPT_RESPONSE = {
  actions: [
    {
      type: "ADD_ITEM",
      itemId: { nested: { itemId: "burrata-salad" } }, // nested instead of string
      quantity: 1,
    },
  ],
  confirmation: "Done",
  executionLog: VALID_EXECUTION_LOG,
};

export const NULL_ACTION_IN_ARRAY = {
  actions: [
    null,
    { type: "ADD_ITEM", itemId: "burrata-salad", quantity: 1 },
    undefined,
  ],
  confirmation: "Done",
  executionLog: VALID_EXECUTION_LOG,
};

export const UNKNOWN_ACTION_TYPE_RESPONSE = {
  actions: [
    { type: "DESTROY_CART", itemId: "burrata-salad" },
    { type: "APPLY_DISCOUNT", itemId: "steak-frites", quantity: 50 },
  ],
  confirmation: "Done with unknown actions.",
  executionLog: VALID_EXECUTION_LOG,
};

export const XSS_INJECTION_RESPONSE = {
  actions: [],
  confirmation:
    '<script>alert("xss")</script> <img src="x" onerror="alert(1)">',
  executionLog: [
    "<script>alert(1)</script>",
    "VALIDATING_MENU...",
    "UPDATING_STATE...",
    "SYNC_COMPLETE",
  ],
};

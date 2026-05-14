/**
 * defensiveParsing.ts - Defensive utilities for safely handling uncertain data
 *
 * These utilities add extra layers of safety for production systems
 * where data from external sources (LLM) may be malformed or unexpected.
 *
 * Principles:
 * - Never crash on malformed data
 * - Return sensible defaults
 * - Log issues for debugging
 * - Validate assumptions explicitly
 */

import type { AIResponse, CartAction } from "./types";

/**
 * Safe parser for cart actions with detailed logging
 */
export function parseCartActions(
  data: unknown,
  logger?: Console,
): CartAction[] {
  const log = logger || console;

  // Null/undefined check
  if (data === null || data === undefined) {
    log.warn("[Defensive] Cart actions is null/undefined");
    return [];
  }

  // Type check
  if (!Array.isArray(data)) {
    log.warn(`[Defensive] Cart actions is not an array:`, data);
    return [];
  }

  const validActions: CartAction[] = [];
  const failures: { action: unknown; reason: string }[] = [];

  for (const item of data) {
    try {
      // Null/undefined check
      if (!item || typeof item !== "object") {
        failures.push({
          action: item,
          reason: "Not an object",
        });
        continue;
      }

      const action = item as Record<string, unknown>;

      // Type check
      if (typeof action.type !== "string") {
        failures.push({
          action: item,
          reason: `Invalid type field: ${action.type}`,
        });
        continue;
      }

      // ItemId check
      if (typeof action.itemId !== "string" || !action.itemId.trim()) {
        failures.push({
          action: item,
          reason: `Invalid itemId: ${action.itemId}`,
        });
        continue;
      }

      // Quantity validation (optional, but if present must be valid)
      if (action.quantity !== undefined) {
        if (
          typeof action.quantity !== "number" ||
          !Number.isFinite(action.quantity) ||
          !Number.isInteger(action.quantity)
        ) {
          failures.push({
            action: item,
            reason: `Invalid quantity: ${action.quantity}`,
          });
          continue;
        }
      }

      // Valid action, add to results
      validActions.push({
        type: action.type as CartAction["type"],
        itemId: action.itemId.trim(),
        ...(action.quantity !== undefined && { quantity: action.quantity }),
      });
    } catch (error) {
      failures.push({
        action: item,
        reason: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  if (failures.length > 0) {
    log.warn(
      `[Defensive] ${failures.length} invalid actions skipped:`,
      failures,
    );
  }

  return validActions;
}

/**
 * Safe parser for AI response with detailed validation
 */
export function parseAIResponse(
  data: unknown,
  logger?: Console,
): AIResponse | null {
  const log = logger || console;

  // Null/undefined check
  if (data === null || data === undefined) {
    log.warn("[Defensive] AI response is null/undefined");
    return null;
  }

  // Type check
  if (typeof data !== "object") {
    log.warn(`[Defensive] AI response is not an object:`, data);
    return null;
  }

  const response = data as Record<string, unknown>;

  try {
    // Validate actions
    const actions = parseCartActions(response.actions, log);

    // Validate confirmation
    if (typeof response.confirmation !== "string") {
      log.warn(
        `[Defensive] Invalid confirmation field:`,
        response.confirmation,
      );
      return null;
    }

    // Validate executionLog
    if (!Array.isArray(response.executionLog)) {
      log.warn(
        "[Defensive] executionLog is not an array:",
        response.executionLog,
      );
      return null;
    }

    // Check length
    if (response.executionLog.length !== 4) {
      log.warn(
        `[Defensive] executionLog has wrong length: ${response.executionLog.length} (expected 4)`,
      );
      return null;
    }

    // Validate all entries are strings
    const invalidLogEntries = response.executionLog.filter(
      (entry) => typeof entry !== "string",
    );
    if (invalidLogEntries.length > 0) {
      log.warn(
        "[Defensive] executionLog contains non-string entries:",
        invalidLogEntries,
      );
      return null;
    }

    // All validations passed
    return {
      actions,
      confirmation: response.confirmation,
      executionLog: response.executionLog as [string, string, string, string],
    };
  } catch (error) {
    log.error("[Defensive] Unexpected error parsing AI response:", error);
    return null;
  }
}

/**
 * Exhaustive validator for a single cart action
 * Returns the action if valid, null if invalid
 */
export function validateCartAction(
  action: unknown,
  logger?: Console,
): CartAction | null {
  const log = logger || console;

  if (!action || typeof action !== "object") {
    log.debug("[Defensive] Action is not an object:", action);
    return null;
  }

  const act = action as Record<string, unknown>;

  // Type must be present
  if (typeof act.type !== "string") {
    log.debug(`[Defensive] Invalid action type:`, act.type);
    return null;
  }

  // ItemId must be present for all action types
  if (typeof act.itemId !== "string" || !act.itemId.trim()) {
    log.debug("[Defensive] Invalid itemId:", act.itemId);
    return null;
  }

  // Quantity validation depends on action type
  switch (act.type) {
    case "ADD_ITEM": {
      if (!act.quantity || typeof act.quantity !== "number") {
        log.debug("[Defensive] ADD_ITEM requires valid quantity");
        return null;
      }
      if (!Number.isInteger(act.quantity) || act.quantity < 1) {
        log.debug("[Defensive] ADD_ITEM quantity must be positive integer");
        return null;
      }
      return {
        type: "ADD_ITEM",
        itemId: act.itemId.trim(),
        quantity: act.quantity,
      };
    }

    case "REMOVE_ITEM": {
      return {
        type: "REMOVE_ITEM",
        itemId: act.itemId.trim(),
      };
    }

    case "UPDATE_QUANTITY": {
      if (act.quantity === undefined || typeof act.quantity !== "number") {
        log.debug("[Defensive] UPDATE_QUANTITY requires valid quantity");
        return null;
      }
      if (!Number.isInteger(act.quantity) || act.quantity < 0) {
        log.debug(
          "[Defensive] UPDATE_QUANTITY quantity must be non-negative integer",
        );
        return null;
      }
      return {
        type: "UPDATE_QUANTITY",
        itemId: act.itemId.trim(),
        quantity: act.quantity,
      };
    }

    default: {
      log.debug(`[Defensive] Unknown action type: ${act.type}`);
      return null;
    }
  }
}

/**
 * Safe execution log parser
 * Always returns array of 4 strings, padding with defaults if needed
 */
export function parseExecutionLog(
  data: unknown,
  logger?: Console,
): [string, string, string, string] {
  const log = logger || console;

  const defaults: [string, string, string, string] = [
    "PROCESSING_INTENT...",
    "VALIDATING_MENU...",
    "UPDATING_STATE...",
    "SYNC_COMPLETE",
  ];

  if (!Array.isArray(data)) {
    log.debug("[Defensive] executionLog is not an array");
    return defaults;
  }

  if (data.length !== 4) {
    log.debug(
      `[Defensive] executionLog has ${data.length} entries, expected 4`,
    );
  }

  const result: [string, string, string, string] = [...defaults];

  for (let i = 0; i < Math.min(data.length, 4); i++) {
    if (typeof data[i] === "string") {
      result[i] = data[i];
    } else {
      log.debug(`[Defensive] executionLog[${i}] is not a string:`, data[i]);
    }
  }

  return result;
}

/**
 * Defensive wrapper for JSON parsing
 * Returns parsed object or null if parsing fails
 */
export function safeJsonParse(jsonString: unknown, logger?: Console): unknown {
  const log = logger || console;

  if (typeof jsonString !== "string") {
    log.debug("[Defensive] Input to safeJsonParse is not a string");
    return null;
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    log.debug(
      "[Defensive] JSON parse error:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * Defensive wrapper for creating a cart action
 * Returns action or null if validation fails
 */
export function createCartAction(
  type: string,
  itemId: string,
  quantity?: number,
  logger?: Console,
): CartAction | null {
  const log = logger || console;

  // Sanitize inputs
  const sanitizedType = String(type).trim().toUpperCase();
  const sanitizedItemId = String(itemId).trim();
  const sanitizedQuantity =
    quantity !== undefined ? Number(quantity) : undefined;

  // Validate
  if (!sanitizedItemId) {
    log.debug("[Defensive] Empty itemId");
    return null;
  }

  if (
    sanitizedQuantity !== undefined &&
    (!Number.isInteger(sanitizedQuantity) || sanitizedQuantity < 0)
  ) {
    log.debug("[Defensive] Invalid quantity:", sanitizedQuantity);
    return null;
  }

  // Build action
  const action: CartAction = {
    type: sanitizedType as CartAction["type"],
    itemId: sanitizedItemId,
    ...(sanitizedQuantity !== undefined && { quantity: sanitizedQuantity }),
  };

  // Validate with validator
  return validateCartAction(action, log);
}

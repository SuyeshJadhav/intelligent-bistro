/**
 * applyCartDelta.ts - Deterministic cart synchronization from AI actions.
 *
 * This utility is the bridge between the AI's natural language understanding
 * and the cart's state mutation. It ensures:
 *
 * 1. Type safety - exhaustive action handling
 * 2. Validation - items must exist in the menu
 * 3. Idempotency - applying the same delta twice should be safe
 * 4. Edge-case protection - defensive against malformed data
 * 5. Single source of truth - Zustand store is the only mutable state
 *
 * Philosophy:
 * - LLM output NEVER mutates state directly
 * - All actions pass strict validation before application
 * - Keep operations deterministic and reversible
 * - Fail loudly but never crash the app
 */

import { menuData } from "@/constants/menuData";
import type { CartAction } from "@/lib/types";

export interface CartStoreMethods {
  addItem: (item: { id: string; name: string; price: number; quantity: number; description: string; imageUrl: string }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
}

/**
 * Validates that a menu item exists and is available for purchase.
 */
function validateMenuItem(itemId: string): boolean {
  return menuData.some((item) => item.id === itemId);
}

/**
 * Applies a single cart action to the Zustand store with full validation.
 *
 * @param action - The action to apply (ADD_ITEM, REMOVE_ITEM, or UPDATE_QUANTITY)
 * @returns true if applied successfully, false if validation failed
 *
 * Design:
 * - Exhaustive switch on action type
 * - Defensive null/undefined checks
 * - Menu validation for ADD operations
 * - Quantity bounds checking
 * - Silent failure (returns false) for invalid actions
 */
function applySingleAction(action: CartAction, store: CartStoreMethods): boolean {
  switch (action.type) {
    case "ADD_ITEM": {
      // Validate item exists in menu
      if (!validateMenuItem(action.itemId)) {
        console.warn(
          `[Cart Delta] Invalid item ID: ${action.itemId}. Not in menu.`,
        );
        return false;
      }

      // Validate quantity
      if (
        !action.quantity ||
        action.quantity < 1 ||
        !Number.isInteger(action.quantity)
      ) {
        console.warn(
          `[Cart Delta] Invalid quantity for ${action.itemId}: ${action.quantity}`,
        );
        return false;
      }

      // Find the menu item to get its details
      const menuItem = menuData.find((item) => item.id === action.itemId);
      if (!menuItem) {
        console.warn(`[Cart Delta] Menu item not found: ${action.itemId}`);
        return false;
      }

      // Add to cart via store
      store.addItem({
        id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: action.quantity,
        description: menuItem.description,
        imageUrl: menuItem.imageUrl,
      });

      return true;
    }

    case "REMOVE_ITEM": {
      // Validate item ID is a non-empty string
      if (!action.itemId || typeof action.itemId !== "string") {
        console.warn(
          `[Cart Delta] Invalid item ID for REMOVE: ${action.itemId}`,
        );
        return false;
      }

      // Remove from cart via store
      store.removeItem(action.itemId);
      return true;
    }

    case "UPDATE_QUANTITY": {
      // Validate item ID
      if (!action.itemId || typeof action.itemId !== "string") {
        console.warn(
          `[Cart Delta] Invalid item ID for UPDATE_QUANTITY: ${action.itemId}`,
        );
        return false;
      }

      // Validate quantity is a non-negative integer
      if (
        action.quantity === undefined ||
        !Number.isInteger(action.quantity) ||
        action.quantity < 0
      ) {
        console.warn(
          `[Cart Delta] Invalid quantity for UPDATE_QUANTITY: ${action.quantity}`,
        );
        return false;
      }

      // Update quantity in store (0 quantity removes the item)
      store.updateQuantity(action.itemId, action.quantity);
      return true;
    }

    // Exhaustive switch - catch any unknown action types
    default: {
      const _exhaustive: never = action as never;
      console.warn(
        `[Cart Delta] Unknown action type received: ${(_exhaustive as any)?.type}`,
      );
      return false;
    }
  }
}

/**
 * Main entry point: applies a delta of cart actions from the AI backend.
 *
 * This is the single source of deterministic cart synchronization.
 *
 * @param actions - Array of actions from the Gemini API response
 * @returns Report of applied/failed actions for debugging
 *
 * Guarantees:
 * - Invalid actions are silently skipped (not thrown)
 * - Zustand store state remains consistent
 * - Each action is applied independently (ordering matters)
 * - No crashes from malformed LLM output
 * - All operations are logged for debugging
 *
 * Example usage (from AIAssistantSheet):
 * ```
 * const response = await sendChatMessage(prompt, cartState);
 * applyCartDelta(response.actions);
 * ```
 */
export function applyCartDelta(actions: CartAction[], store: CartStoreMethods): {
  applied: number;
  failed: number;
  skipped: number;
} {
  if (!Array.isArray(actions)) {
    console.warn("[Cart Delta] Actions is not an array:", actions);
    return { applied: 0, failed: 0, skipped: 0 };
  }

  let applied = 0;
  let failed = 0;
  let skipped = 0;

  for (const action of actions) {
    // Validate action structure
    if (!action || typeof action !== "object") {
      console.warn("[Cart Delta] Skipping non-object action:", action);
      skipped++;
      continue;
    }

    // Attempt to apply the action
    try {
      const success = applySingleAction(action as CartAction, store);
      if (success) {
        applied++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(
        "[Cart Delta] Unexpected error applying action:",
        action,
        error,
      );
      failed++;
    }
  }

  console.log(
    `[Cart Delta] Applied: ${applied}, Failed: ${failed}, Skipped: ${skipped}`,
  );

  return { applied, failed, skipped };
}

/**
 * Safely applies cart delta from potentially malformed AI response.
 *
 * This wrapper adds an extra layer of safety:
 * - Returns early if actions is null/undefined
 * - Catches any exceptions
 * - Returns safe default report
 *
 * Use this when you're not 100% sure about the response shape.
 */
export function applyCartDeltaSafe(actions: unknown, store: CartStoreMethods): {
  applied: number;
  failed: number;
  skipped: number;
} {
  try {
    if (!Array.isArray(actions)) {
      console.warn("[Cart Delta Safe] Actions is not an array");
      return { applied: 0, failed: 0, skipped: 0 };
    }

    return applyCartDelta(actions, store);
  } catch (error) {
    console.error("[Cart Delta Safe] Unexpected error:", error);
    return { applied: 0, failed: 0, skipped: 0 };
  }
}

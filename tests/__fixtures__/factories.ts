/**
 * factories.ts - Type-safe test data factories
 *
 * Prefer factories over hardcoded fixtures. Factories produce
 * fresh, isolated objects on every call — no shared mutation risk.
 */

import type { CartAction } from "@/lib/types";
import type { CartItem } from "@/store/cartStore";
import { MENU_ITEMS } from "./menuFixtures";

// ── Cart item factory ─────────────────────────────────────────────────────

let _cartItemIdCounter = 0;

/**
 * Produces a CartItem from a real menu item with optional overrides.
 * Defaults to the first menu item if no itemId provided.
 */
export function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  _cartItemIdCounter++;
  const base = MENU_ITEMS[0]!;
  return {
    id: base.id,
    name: base.name,
    price: base.price,
    quantity: 1,
    description: base.description,
    imageUrl: base.imageUrl,
    ...overrides,
  };
}

/**
 * Creates a cart with N distinct menu items (real IDs).
 */
export function makeCart(itemCount: number): CartItem[] {
  return MENU_ITEMS.slice(0, itemCount).map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: 1,
    description: item.description,
    imageUrl: item.imageUrl,
  }));
}

/**
 * Creates a cart item from a specific menu item ID.
 * Throws if the itemId doesn't exist in the menu fixture.
 */
export function makeCartItemFromMenu(
  itemId: string,
  quantity = 1,
): CartItem {
  const menuItem = MENU_ITEMS.find((i) => i.id === itemId);
  if (!menuItem) {
    throw new Error(
      `[Factory] Unknown menu item ID: ${itemId}. Use a valid ID from MENU_ITEMS.`,
    );
  }
  return {
    id: menuItem.id,
    name: menuItem.name,
    price: menuItem.price,
    quantity,
    description: menuItem.description,
    imageUrl: menuItem.imageUrl,
  };
}

// ── CartAction factories ──────────────────────────────────────────────────

export function makeAddAction(
  itemId: string,
  quantity = 1,
): CartAction {
  return { type: "ADD_ITEM", itemId, quantity };
}

export function makeRemoveAction(itemId: string): CartAction {
  return { type: "REMOVE_ITEM", itemId };
}

export function makeUpdateAction(
  itemId: string,
  quantity: number,
): CartAction {
  return { type: "UPDATE_QUANTITY", itemId, quantity };
}

/**
 * Builds a realistic multi-step order sequence.
 * Useful for integration-level tests.
 */
export function makeRealisticOrderSequence(): CartAction[] {
  return [
    makeAddAction("burrata-salad", 1),
    makeAddAction("tagliatelle", 2),
    makeAddAction("yuzu-spritz", 2),
    makeUpdateAction("tagliatelle", 1),
    makeRemoveAction("yuzu-spritz"),
    makeAddAction("cold-brew", 2),
  ];
}

// ── AI message factories ──────────────────────────────────────────────────

export interface TestMessage {
  role: "user" | "ai";
  content: string;
}

export function makeUserMessage(content = "Add 2 burrata salads"): TestMessage {
  return { role: "user", content };
}

export function makeAIMessage(content = "Added 2 burrata salads to your cart."): TestMessage {
  return { role: "ai", content };
}

/**
 * Creates a conversation thread with alternating user/ai messages.
 */
export function makeConversation(pairs: number): TestMessage[] {
  const messages: TestMessage[] = [];
  for (let i = 0; i < pairs; i++) {
    messages.push(makeUserMessage(`Order request ${i + 1}`));
    messages.push(makeAIMessage(`Processed order ${i + 1}`));
  }
  return messages;
}

// ── Reset counter between tests ───────────────────────────────────────────

export function resetFactoryCounters(): void {
  _cartItemIdCounter = 0;
}

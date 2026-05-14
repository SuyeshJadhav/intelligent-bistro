/**
 * storeHelpers.ts - Utilities for clean Zustand store isolation in tests
 *
 * Philosophy:
 * - NEVER share store state between tests
 * - Always reset to deterministic initial state in beforeEach
 * - Use getState() for assertions, not hooks (hooks require React context)
 */

import { useAIStore } from "@/store/aiStore";
import { useCartStore } from "@/store/cartStore";
import type { CartItem } from "@/store/cartStore";

// ── Cart store helpers ────────────────────────────────────────────────────

/**
 * Resets the cart store to the initial empty state.
 * Call this in beforeEach for any test touching the cart.
 */
export function resetCartStore(): void {
  useCartStore.setState({
    items: [],
    totalItems: 0,
    totalPrice: 0,
  });
}

/**
 * Seeds the cart store with a pre-defined set of items.
 * Automatically calculates derived totals.
 */
export function seedCartStore(items: CartItem[]): void {
  const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);
  const totalPrice = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  useCartStore.setState({ items, totalItems, totalPrice });
}

/**
 * Snapshot the current cart state for later comparison.
 */
export function snapshotCart() {
  const { items, totalItems, totalPrice } = useCartStore.getState();
  // Deep-clone so mutations don't affect the snapshot
  return {
    items: JSON.parse(JSON.stringify(items)) as CartItem[],
    totalItems,
    totalPrice,
  };
}

/**
 * Returns true if two cart snapshots are identical.
 */
export function cartSnapshotsEqual(
  a: ReturnType<typeof snapshotCart>,
  b: ReturnType<typeof snapshotCart>,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── AI store helpers ──────────────────────────────────────────────────────

/**
 * Resets the AI store to the initial state.
 */
export function resetAIStore(): void {
  useAIStore.setState({
    isOpen: false,
    isProcessing: false,
    messages: [],
    executionLog: [],
  });
}

/**
 * Resets ALL stores to their initial states.
 * Prefer calling this once in a global beforeEach.
 */
export function resetAllStores(): void {
  resetCartStore();
  resetAIStore();
}

// ── Assertion helpers ─────────────────────────────────────────────────────

/**
 * Asserts that cart totals are mathematically consistent with items.
 * Use this after any cart mutation to verify store integrity.
 */
export function assertCartConsistency(): void {
  const { items, totalItems, totalPrice } = useCartStore.getState();
  const expectedItems = items.reduce((acc, i) => acc + i.quantity, 0);
  const expectedPrice = items.reduce(
    (acc, i) => acc + i.price * i.quantity,
    0,
  );

  if (totalItems !== expectedItems) {
    throw new Error(
      `[CartAssert] totalItems mismatch: got ${totalItems}, expected ${expectedItems}`,
    );
  }

  if (Math.abs(totalPrice - expectedPrice) > 0.001) {
    throw new Error(
      `[CartAssert] totalPrice mismatch: got ${totalPrice}, expected ${expectedPrice}`,
    );
  }
}

/**
 * Gets a cart item by ID, or throws if not found.
 */
export function getCartItem(itemId: string): CartItem {
  const item = useCartStore.getState().items.find((i) => i.id === itemId);
  if (!item) {
    throw new Error(
      `[CartAssert] Item "${itemId}" not found in cart. Items: ${
        useCartStore
          .getState()
          .items.map((i) => i.id)
          .join(", ")
      }`,
    );
  }
  return item;
}

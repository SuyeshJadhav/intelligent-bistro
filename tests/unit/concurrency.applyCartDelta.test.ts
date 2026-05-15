import { applyCartDelta } from "@/lib/applyCartDelta";
import { describe, expect, it } from "vitest";

describe("applyCartDelta concurrency semantics", () => {
  it("deterministic cumulative effect for repeated ADD_ITEM actions", () => {
    const mockStoreItems: any[] = [];
    const store = {
      addItem: (item: any) => {
        const existing = mockStoreItems.find((i) => i.id === item.id);
        if (existing) existing.quantity += item.quantity;
        else mockStoreItems.push({ ...item });
      },
      removeItem: (id: string) => {
        const idx = mockStoreItems.findIndex((i) => i.id === id);
        if (idx >= 0) mockStoreItems.splice(idx, 1);
      },
      updateQuantity: (id: string, quantity: number) => {
        const existing = mockStoreItems.find((i) => i.id === id);
        if (existing) existing.quantity = quantity;
      },
    } as any;

    const actions = [
      { type: "ADD_ITEM", itemId: "yuzu-spritz", quantity: 1 },
    ] as any;

    // Apply twice, simulating two concurrent/sequential identical deltas
    applyCartDelta(actions, store);
    applyCartDelta(actions, store);

    expect(mockStoreItems.length).toBe(1);
    expect(mockStoreItems[0].quantity).toBe(2);
  });
});

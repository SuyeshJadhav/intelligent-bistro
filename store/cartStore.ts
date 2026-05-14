import { create } from "zustand";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  description: string;
  imageUrl: string;
}

type CartInput = Omit<CartItem, "quantity"> & {
  quantity?: number;
};

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (item: CartInput) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

const calculateTotals = (items: CartItem[]) => ({
  totalItems: items.reduce((count, item) => count + item.quantity, 0),
  totalPrice: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
});

export const useCartStore = create<CartState>((set) => ({
  items: [],
  totalItems: 0,
  totalPrice: 0,
  addItem: (item) =>
    set((state) => {
      const quantityToAdd = item.quantity ?? 1;
      const existingItem = state.items.find(
        (cartItem) => cartItem.id === item.id,
      );

      const nextItems = existingItem
        ? state.items.map((cartItem) =>
            cartItem.id === item.id
              ? { ...cartItem, quantity: cartItem.quantity + quantityToAdd }
              : cartItem,
          )
        : [...state.items, { ...item, quantity: quantityToAdd }];

      return {
        items: nextItems,
        ...calculateTotals(nextItems),
      };
    }),
  removeItem: (id) =>
    set((state) => {
      const nextItems = state.items.filter((item) => item.id !== id);

      return {
        items: nextItems,
        ...calculateTotals(nextItems),
      };
    }),
  updateQuantity: (id, quantity) =>
    set((state) => {
      const nextItems =
        quantity <= 0
          ? state.items.filter((item) => item.id !== id)
          : state.items.map((item) =>
              item.id === id ? { ...item, quantity } : item,
            );

      return {
        items: nextItems,
        ...calculateTotals(nextItems),
      };
    }),
  clearCart: () =>
    set({
      items: [],
      totalItems: 0,
      totalPrice: 0,
    }),
}));

/**
 * menuFixtures.ts - Canonical test menu data
 *
 * Mirrors the real menuData exactly so tests assert against
 * real item IDs, names, and prices without importing the production
 * constant (which would drag in side-effects).
 */

export interface TestMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "Starters" | "Mains" | "Drinks";
  imageUrl: string;
}

export const MENU_ITEMS: TestMenuItem[] = [
  {
    id: "burrata-salad",
    name: "Burrata & Orchard Tomatoes",
    description: "Creamy burrata with sweet tomatoes and basil oil.",
    price: 14,
    category: "Starters",
    imageUrl: "https://example.com/burrata.jpg",
  },
  {
    id: "celeriac-soup",
    name: "Smoked Celeriac Soup",
    description: "Silky winter soup finished with herb oil and seeds.",
    price: 12,
    category: "Starters",
    imageUrl: "https://example.com/celeriac.jpg",
  },
  {
    id: "tagliatelle",
    name: "Black Pepper Tagliatelle",
    description: "Fresh pasta with parmesan cream and black pepper.",
    price: 24,
    category: "Mains",
    imageUrl: "https://example.com/tagliatelle.jpg",
  },
  {
    id: "salmon-bowl",
    name: "Miso Salmon Bowl",
    description: "Glazed salmon with rice, greens, and sesame.",
    price: 28,
    category: "Mains",
    imageUrl: "https://example.com/salmon.jpg",
  },
  {
    id: "steak-frites",
    name: "Charred Steak Frites",
    description: "Grass-fed steak served with crisp potatoes and jus.",
    price: 34,
    category: "Mains",
    imageUrl: "https://example.com/steak.jpg",
  },
  {
    id: "mushroom-risotto",
    name: "Wild Mushroom Risotto",
    description: "Creamy arborio rice with roasted mushrooms and thyme.",
    price: 26,
    category: "Mains",
    imageUrl: "https://example.com/risotto.jpg",
  },
  {
    id: "yuzu-spritz",
    name: "Yuzu Spritz",
    description: "Bright citrus spritz with sparkling wine and herbs.",
    price: 11,
    category: "Drinks",
    imageUrl: "https://example.com/yuzu.jpg",
  },
  {
    id: "cold-brew",
    name: "Black Sesame Cold Brew",
    description: "Iced coffee layered with toasted sesame cream.",
    price: 9,
    category: "Drinks",
    imageUrl: "https://example.com/coldbrew.jpg",
  },
  {
    id: "vermouth-soda",
    name: "Citrus Vermouth Soda",
    description: "A crisp low-ABV pour with lemon and rosemary.",
    price: 12,
    category: "Drinks",
    imageUrl: "https://example.com/vermouth.jpg",
  },
];

// Convenience exports for common test items
export const STARTER_1 = MENU_ITEMS.find((i) => i.id === "burrata-salad")!;
export const STARTER_2 = MENU_ITEMS.find((i) => i.id === "celeriac-soup")!;
export const MAIN_1 = MENU_ITEMS.find((i) => i.id === "tagliatelle")!;
export const MAIN_2 = MENU_ITEMS.find((i) => i.id === "salmon-bowl")!;
export const MAIN_3 = MENU_ITEMS.find((i) => i.id === "steak-frites")!;
export const DRINK_1 = MENU_ITEMS.find((i) => i.id === "yuzu-spritz")!;
export const DRINK_2 = MENU_ITEMS.find((i) => i.id === "cold-brew")!;

export const VALID_ITEM_IDS = MENU_ITEMS.map((i) => i.id);
export const INVALID_ITEM_IDS = [
  "pizza",
  "hamburger",
  "fake-item-xyz",
  "grilled-chicken-sandwich",
  "",
  "   ",
  "undefined",
  "null",
  "<script>alert(1)</script>",
];

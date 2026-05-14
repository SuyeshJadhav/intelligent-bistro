export type MenuCategory = "Starters" | "Mains" | "Drinks";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
}

export const menuItems: MenuItem[] = [
  {
    id: "burrata-salad",
    name: "Burrata & Orchard Tomatoes",
    description: "Creamy burrata with sweet tomatoes and basil oil.",
    price: 14,
    category: "Starters",
  },
  {
    id: "celeriac-soup",
    name: "Smoked Celeriac Soup",
    description: "Silky winter soup finished with herb oil and seeds.",
    price: 12,
    category: "Starters",
  },
  {
    id: "tagliatelle",
    name: "Black Pepper Tagliatelle",
    description: "Fresh pasta with parmesan cream and black pepper.",
    price: 24,
    category: "Mains",
  },
  {
    id: "salmon-bowl",
    name: "Miso Salmon Bowl",
    description: "Glazed salmon with rice, greens, and sesame.",
    price: 28,
    category: "Mains",
  },
  {
    id: "steak-frites",
    name: "Charred Steak Frites",
    description: "Grass-fed steak served with crisp potatoes and jus.",
    price: 34,
    category: "Mains",
  },
  {
    id: "mushroom-risotto",
    name: "Wild Mushroom Risotto",
    description: "Creamy arborio rice with roasted mushrooms and thyme.",
    price: 26,
    category: "Mains",
  },
  {
    id: "yuzu-spritz",
    name: "Yuzu Spritz",
    description: "Bright citrus spritz with sparkling wine and herbs.",
    price: 11,
    category: "Drinks",
  },
  {
    id: "cold-brew",
    name: "Black Sesame Cold Brew",
    description: "Iced coffee layered with toasted sesame cream.",
    price: 9,
    category: "Drinks",
  },
  {
    id: "vermouth-soda",
    name: "Citrus Vermouth Soda",
    description: "A crisp low-ABV pour with lemon and rosemary.",
    price: 12,
    category: "Drinks",
  },
];

export type MenuCategory = "Starters" | "Mains" | "Drinks";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
  imageUrl: string;
}

export const menuCategories = ["All", "Starters", "Mains", "Drinks"] as const;

export const menuData: MenuItem[] = [
  {
    id: "burrata-salad",
    name: "Burrata & Orchard Tomatoes",
    description: "Creamy burrata with sweet tomatoes and basil oil.",
    price: 14,
    category: "Starters",
    imageUrl:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "celeriac-soup",
    name: "Smoked Celeriac Soup",
    description: "Silky winter soup finished with herb oil and seeds.",
    price: 12,
    category: "Starters",
    imageUrl:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80&sat=-100",
  },
  {
    id: "tagliatelle",
    name: "Black Pepper Tagliatelle",
    description: "Fresh pasta with parmesan cream and black pepper.",
    price: 24,
    category: "Mains",
    imageUrl:
      "https://images.unsplash.com/photo-1529059997568-3d847b1154f0?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "salmon-bowl",
    name: "Miso Salmon Bowl",
    description: "Glazed salmon with rice, greens, and sesame.",
    price: 28,
    category: "Mains",
    imageUrl:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "steak-frites",
    name: "Charred Steak Frites",
    description: "Grass-fed steak served with crisp potatoes and jus.",
    price: 34,
    category: "Mains",
    imageUrl:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "mushroom-risotto",
    name: "Wild Mushroom Risotto",
    description: "Creamy arborio rice with roasted mushrooms and thyme.",
    price: 26,
    category: "Mains",
    imageUrl:
      "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "yuzu-spritz",
    name: "Yuzu Spritz",
    description: "Bright citrus spritz with sparkling wine and herbs.",
    price: 11,
    category: "Drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "cold-brew",
    name: "Black Sesame Cold Brew",
    description: "Iced coffee layered with toasted sesame cream.",
    price: 9,
    category: "Drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "vermouth-soda",
    name: "Citrus Vermouth Soda",
    description: "A crisp low-ABV pour with lemon and rosemary.",
    price: 12,
    category: "Drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1514361892635-6b07e31e75f2?auto=format&fit=crop&w=1200&q=80",
  },
];

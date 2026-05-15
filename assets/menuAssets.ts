import type { ImageSourcePropType } from "react-native";

export const menuAssets = {
  "burrata-orchard-tomatoes": require("./menu/burrata-orchard-tomatoes.webp"),
  "smoked-celeriac-soup": require("./menu/smoked-celeriac-soup.webp"),
  "black-pepper-tagliatelle": require("./menu/black-pepper-tagliatelle.webp"),
  "miso-salmon-bowl": require("./menu/miso-salmon-bowl.webp"),
  "charred-steak-frites": require("./menu/charred-steak-frites.webp"),
  "wild-mushroom-risotto": require("./menu/wild-mushroom-risotto.webp"),
  "yuzu-spritz": require("./menu/yuzu-spritz.webp"),
  "black-sesame-cold-brew": require("./menu/black-sesame-cold-brew.webp"),
  "citrus-vermouth-soda": require("./menu/citrus-vermouth-soda.webp"),
} as const satisfies Record<string, ImageSourcePropType>;

export type MenuAssetKey = keyof typeof menuAssets;

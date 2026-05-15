import type { ImageSourcePropType } from "react-native";

export const menuAssets = {
  "burrata-orchard-tomatoes": { uri: "test://burrata-orchard-tomatoes" },
  "smoked-celeriac-soup": { uri: "test://smoked-celeriac-soup" },
  "black-pepper-tagliatelle": { uri: "test://black-pepper-tagliatelle" },
  "miso-salmon-bowl": { uri: "test://miso-salmon-bowl" },
  "charred-steak-frites": { uri: "test://charred-steak-frites" },
  "wild-mushroom-risotto": { uri: "test://wild-mushroom-risotto" },
  "yuzu-spritz": { uri: "test://yuzu-spritz" },
  "black-sesame-cold-brew": { uri: "test://black-sesame-cold-brew" },
  "citrus-vermouth-soda": { uri: "test://citrus-vermouth-soda" },
} as const satisfies Record<string, ImageSourcePropType>;

export type MenuAssetKey = keyof typeof menuAssets;

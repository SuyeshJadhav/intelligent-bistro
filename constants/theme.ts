export const THEME = {
  colors: {
    background: "#F6F6F3",
    surface: "#FFFFFF",
    "surface-elevated": "#FCFCFA",
    "primary-text": "#111111",
    "secondary-text": "#666666",
    "muted-text": "#9B9B9B",
    divider: "#ECECE7",
    "ai-accent": "#D9FF3F",
    error: "#BA1A1A",
  },
  spacing: {
    base: 8,
    xs: 4,
    sm: 12,
    md: 24,
    lg: 48,
    xl: 80,
    "container-margin": 24,
    gutter: 16,
  },
  fontFamily: {
    sans: ["Inter_400Regular", "Inter_500Medium", "Inter_600SemiBold"],
    mono: ["JetBrainsMono_500Medium", "JetBrainsMono_600SemiBold"],
  },
  borderRadius: {
    sm: "0.25rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
  },
} as const;

export type Theme = typeof THEME;

export const Colors = {
  light: {
    background: THEME.colors.background,
    text: THEME.colors["primary-text"],
    tint: THEME.colors["primary-text"],
    icon: THEME.colors["muted-text"],
    tabIconDefault: THEME.colors["muted-text"],
    tabIconSelected: THEME.colors["primary-text"],
  },
  dark: {
    background: THEME.colors.background,
    text: THEME.colors["primary-text"],
    tint: THEME.colors["primary-text"],
    icon: THEME.colors["muted-text"],
    tabIconDefault: THEME.colors["muted-text"],
    tabIconSelected: THEME.colors["primary-text"],
  },
} as const;

export const Fonts = {
  sans: THEME.fontFamily.sans[0],
  serif: THEME.fontFamily.sans[0],
  rounded: THEME.fontFamily.sans[1],
  mono: THEME.fontFamily.mono[0],
} as const;

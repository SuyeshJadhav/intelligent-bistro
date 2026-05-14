---
name: The Intelligent Bistro
colors:
  surface: '#fdf8f8'
  surface-dim: '#ddd9d8'
  surface-bright: '#fdf8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3f2'
  surface-container: '#f1edec'
  surface-container-high: '#ebe7e6'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#444748'
  inverse-surface: '#313030'
  inverse-on-surface: '#f4f0ef'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#536500'
  on-secondary: '#ffffff'
  secondary-container: '#ccf230'
  on-secondary-container: '#596c00'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1d1b1a'
  on-tertiary-container: '#868381'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#ccf230'
  secondary-fixed-dim: '#b1d400'
  on-secondary-fixed: '#171e00'
  on-secondary-fixed-variant: '#3e4c00'
  tertiary-fixed: '#e6e1df'
  tertiary-fixed-dim: '#cac6c3'
  on-tertiary-fixed: '#1d1b1a'
  on-tertiary-fixed-variant: '#484645'
  background: '#fdf8f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  system-code:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  system-label:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  container-margin: 24px
  gutter: 16px
---

## Brand & Style

This design system is built on the philosophy of **Industrial Precision**. It treats the act of dining and ordering as a high-fidelity engineering process, stripped of unnecessary decorative noise to focus on the intelligence of the AI and the quality of the ingredients.

The aesthetic draws from the functionalism of Nothing OS and the refined utility of Linear. It aims to evoke a sense of "Calm Intelligence"—a UI that stays out of the way until needed, providing a premium, tactile experience. The target audience is the discerning, tech-forward diner who values efficiency, transparency, and a curated, editorial aesthetic. The emotional response should be one of quiet confidence and effortless control.

## Colors

The color palette of this design system is fundamentally monochrome and architectural. 

- **The Base:** The background uses a slightly warm, off-white (#F6F6F3) to prevent screen fatigue and provide a more "organic paper" feel than pure digital white.
- **Surface Logic:** Surfaces use pure white (#FFFFFF) for clarity, while elevated surfaces use a subtle tint (#FCFCFA) to create depth through tonal shifts rather than aggressive shadows.
- **The AI Accent:** #D9FF3F (Volt) is reserved strictly for AI-native moments: recommendation badges, active voice-listening states, and "smart" execution steps. It serves as the "pulse" of the system.
- **Typography:** Contrast is managed through a hierarchy of grays to guide the eye from "The Dish" (Primary) to "The Description" (Secondary) to "The Meta-data" (Muted).

## Typography

This design system employs a dual-font strategy to separate the "Experience" from the "Engine."

1.  **Inter (The Experience):** Used for all human-centric content. It is set with tight letter-spacing in headlines to achieve an authoritative, editorial look and generous line height in body text for legibility.
2.  **JetBrains Mono (The Engine):** Used for all machine-centric data. When the AI is processing an order, calculating totals, or providing system feedback, the font switches to JetBrains Mono. This creates a visual "context switch" for the user, signaling that they are looking at raw data or AI reasoning.

Hierarchy is strictly enforced; use `system-label` for small tags and `display-lg` for featured menu items.

## Layout & Spacing

This design system utilizes a **Fluid Grid** with fixed-width logic for desktop to maintain an editorial feel. 

- **The 8px Rhythm:** All spacing must be a multiple of 8.
- **Whitespace as a Feature:** Large internal margins (xl: 80px) are used to separate major sections, creating a sense of luxury and calm.
- **Mobile:** A 4-column grid with 24px side margins.
- **Desktop/Tablet:** A 12-column grid. Elements should often "float" centered with significant negative space on the flanks to mimic a high-end physical menu.
- **The "Bento" Logic:** For dashboard views (Order tracking, Personal stats), use a modular grid where each "cell" has a consistent 24px padding.

## Elevation & Depth

In line with industrial minimalism, this design system avoids heavy shadows. Depth is communicated through **Tonal Layering** and **Precision Outlines**.

- **Layers:** The background is #F6F6F3. Cards and interactive surfaces sit "above" this on #FFFFFF.
- **Outlines:** Use 1px hairline dividers or borders (#ECECE7). For interactive elements, a subtle 1px border is preferred over a shadow.
- **Tactile State:** When a user interacts with a card, instead of a shadow, the element may shift color slightly to #FCFCFA or show a 1px border in #111111.
- **Glassmorphism:** Reserved only for sticky navigation headers or overlays, using a heavy backdrop blur (20px) and 80% opacity on the surface color.

## Shapes

The shape language is characterized by "Soft Industrial" geometry. While the grid is rigid, the containers are inviting.

- **Primary Containers:** 24px (`rounded-xl`) for main menu cards and large modal containers.
- **Secondary Elements:** 16px (`rounded-lg`) for buttons, input fields, and smaller UI components.
- **Tactile Feel:** The combination of large radii and thin hairline borders creates a "premium hardware" feel, reminiscent of modern high-end electronics.
- **Icons:** Should be stroke-based (1.5px weight) with slight rounding on terminals to match the font's geometry.

## Components

### Buttons
Buttons are either "Solid" or "Ghost." 
- **Solid:** Background #111111, Text #FFFFFF. No shadow.
- **Ghost:** Border 1px #ECECE7, Text #111111.
- **AI-Action:** Background #D9FF3F, Text #111111. Used for "Smart Order" or "Ask AI."

### Cards
Cards use #FFFFFF with a 24px corner radius. They should not have shadows by default. Use a 1px #ECECE7 border to define the edge against the #F6F6F3 background. Internal padding should be a minimum of 24px (`md`).

### AI Execution Log
A unique component for this design system. It displays JetBrains Mono text in a "terminal style" box. It uses a subtle dot-matrix background pattern (Nothing OS inspired) to indicate a background process is occurring.

### Inputs
Fields are #FFFFFF with a 1px #ECECE7 border. On focus, the border changes to #111111. Labels use `system-label` (JetBrains Mono) and are positioned above the field.

### Selection States
Radio buttons and checkboxes are custom-engineered: square with 4px rounded corners. When active, they are filled with #111111 or #D9FF3F for AI-suggested options.
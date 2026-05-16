# The Intelligent Bistro Progress Report

Date: 2026-05-14

## Completed

- Installed the requested app dependencies: NativeWind v4, Tailwind CSS, Gorhom Bottom Sheet, Reanimated, Gesture Handler, Expo Blur, Zustand, and the Google font packages for Inter and JetBrains Mono.
- Configured NativeWind v4 with `tailwind.config.js`, `babel.config.js`, `metro.config.js`, `apps/frontend/global.css`, and the generated `apps/frontend/nativewind-env.d.ts`.
- Added the design token source of truth in `apps/frontend/constants/theme.ts` with typed colors, spacing, fonts, and radii based on `docs/DESIGN.md`.
- Created the requested store scaffolds in `apps/frontend/store/cartStore.ts` and `apps/frontend/store/aiStore.ts`.
- Added the requested folder structure with `.gitkeep` files under `apps/frontend/components/`, `apps/frontend/store/`, `apps/frontend/lib/`, and `apps/frontend/constants/`.
- Updated `apps/frontend/app/_layout.tsx` to load fonts, keep the splash screen hidden until ready, wrap the app in `GestureHandlerRootView`, and import global CSS.
- Added a placeholder root screen in `apps/frontend/app/index.tsx` using the project tokens.

## Menu Screen

- Replaced the root placeholder with a static menu screen in `apps/frontend/app/index.tsx`.
- Added `apps/frontend/constants/menuData.ts` with 9 menu items across the `All`, `Starters`, `Mains`, and `Drinks` categories.
- Created the menu UI pieces in `apps/frontend/components/menu/CategoryPills.tsx`, `apps/frontend/components/menu/MenuCard.tsx`, `apps/frontend/components/menu/MiniCartBar.tsx`, and `apps/frontend/components/menu/SearchBar.tsx`.
- Wired the menu cards to the existing Zustand cart store so the Add button updates cart totals.
- Added safe-area support in `apps/frontend/app/_layout.tsx` with `SafeAreaProvider` so the menu header and sticky region can lay out correctly.
- Switched the menu cards to use bundled local artwork from `assets/menu/` instead of only remote image URLs.
- Added a runtime image fallback so the card can recover to the remote image source if a bundled asset fails to load on-device.
- Tuned the menu card image frame so the artwork fits inside the card instead of overflowing the layout on mobile.

## Cart Drawer

- Added the cart drawer shell in `apps/frontend/components/cart/CartSheet.tsx` with `@gorhom/bottom-sheet` and the shared theme tokens.
- Wired the View Cart action through `apps/frontend/components/cart/CartProvider.tsx` and `apps/frontend/components/menu/MiniCartBar.tsx` so the drawer opens from the cart bar.
- Tuned the drawer to open at 50% by default and expand to full height with only two explicit snap points.
- Restructured the sheet so the item list scrolls inside the available space while the total and Confirm Order button stay visible at the 50% height.
- Disabled dynamic sizing on the sheet to avoid an extra intermediate snap point.

## Interaction Fix

- Investigated the pill tap issue while scrolling and confirmed it was a gesture/responder conflict rather than a filter state bug.
- Added `nestedScrollEnabled` to the main menu scroll container and the horizontal category pill scroller to improve touch handling without changing the screen structure.

## Startup Cleanup

- Removed the Expo starter home screen from `app/(tabs)/index.tsx` by moving the tab home route to `app/(tabs)/home.tsx`.
- Replaced the starter `explore` content with a minimal placeholder screen.
- Updated the tabs layout so the app starts on the clean root route instead of the default starter tab flow.

## Validation

- `npm run lint` passes.
- Workspace error checks pass after the NativeWind and routing fixes.
- `npm run lint` passes after the menu screen and gesture handling updates.
- Workspace error checks pass after the cart drawer layout and snap-point updates.
- Workspace error checks pass after the local menu artwork, image fallback, and menu card sizing updates.

## Notes

- The app is intentionally scaffold-only right now; no feature screen logic has been added yet.
- The current files are set up for the next phase: building cart, AI, and checkout UI on top of the shared theme, stores, and menu screen.

## Backend

- Scaffolded a Node.js TypeScript backend under the `apps/backend/` folder with Express and strict TypeScript.
- Mirrored the frontend menu in `apps/backend/src/data/menu.ts` (same ids, names, descriptions, prices, categories).
- Implemented a Gemini wrapper in `apps/backend/src/lib/gemini.ts` with a JSON-only system prompt, prompt construction (user message + formatted menu + cart state), response parsing, and strict Zod validation of the AI response.
- Added `POST /api/chat` in `apps/backend/src/routes/chat.ts` with Zod request validation and safe error handling (400 for invalid body, 500 for processing errors).
- Added server entry at `apps/backend/src/index.ts` with CORS, JSON middleware, a health check (`GET /health`), and router mount at `/api`.
- Added `apps/backend/package.json`, `apps/backend/tsconfig.json`, and `apps/backend/.env.example` (GEMINI_API_KEY and PORT).
- The initially referenced package `@googleai/sdk` was not available on npm; I switched to the official `@google/genai` package and updated the Gemini wrapper accordingly.

## Backend Validation & Run

- Dependencies were installed in `apps/backend/` and `npm run build` (TypeScript compile) succeeds locally.
- The Gemini wrapper is defensive: it strips markdown fences, parses JSON, validates with Zod (enforcing the required executionLog length of 4), and returns a safe fallback response on any error so the server cannot crash due to malformed model output.

To run the backend locally (from repo root):

```bash
cd apps/backend
npm install
npm run dev
```

Environment:

- Copy `apps/backend/.env.example` to `apps/backend/.env` and set `GEMINI_API_KEY`.

## Notes / Next Steps

- The AI overlay in the app still uses a mock send flow; I can wire it to call `POST /api/chat` and apply returned `actions` to the frontend cart store next.
- We should lock down CORS and add authentication for production later.
- The menu image filenames currently use the original descriptive names; they work, but kebab-case names would be easier to maintain long-term.

## 2026-05-15 Fixes

- Fixed a bug in the AI confirmation flow where accepting a clarification (e.g. replying "yes" after "add pasta") could cause the wrong item to be added. The orchestrator now treats short affirmative or numeric replies as clarification acceptance and preserves the request context; `applyCartDelta` was hardened to resolve human-readable menu names to menu ids. Added unit and integration tests to cover the scenario.

/**
 * vitest.setup.ts - Global test configuration and mocks
 *
 * This file runs before every test file.
 * Sets up:
 * - React Native mocks (prevents native module errors)
 * - Expo module mocks
 * - Animation library mocks
 * - Custom Vitest matchers
 * - Console suppression for expected warnings
 * - MSW node setup hint
 */

import { afterEach, beforeEach, expect, vi } from "vitest";

// ── React Native module mocks ─────────────────────────────────────────────

vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  ScrollView: "ScrollView",
  Pressable: "Pressable",
  SafeAreaView: "SafeAreaView",
  TouchableOpacity: "TouchableOpacity",
  FlatList: "FlatList",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: {
    create: (styles: Record<string, any>) => styles,
    flatten: (style: any) => style,
  },
  Platform: {
    OS: "ios",
    select: (obj: Record<string, any>) => obj.ios ?? obj.default,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
  },
  Keyboard: {
    dismiss: vi.fn(),
    addListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  Animated: {
    View: "Animated.View",
    Text: "Animated.Text",
    Value: vi.fn(() => ({
      setValue: vi.fn(),
      addListener: vi.fn(),
      interpolate: vi.fn(() => 0),
    })),
    timing: vi.fn(() => ({ start: vi.fn() })),
    spring: vi.fn(() => ({ start: vi.fn() })),
    parallel: vi.fn(() => ({ start: vi.fn() })),
    sequence: vi.fn(() => ({ start: vi.fn() })),
  },
}));

// ── Expo module mocks ──────────────────────────────────────────────────────

vi.mock("expo-blur", () => ({
  BlurView: "BlurView",
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { name: "intelligent-bistro" },
  },
}));

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  selectionAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium", Heavy: "Heavy" },
}));

vi.mock("expo-router", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  })),
  Link: "Link",
  Stack: { Screen: "Stack.Screen" },
  Tabs: { Screen: "Tabs.Screen" },
}));

// ── Animation library mocks ────────────────────────────────────────────────

vi.mock("react-native-reanimated", () => ({
  default: {
    createAnimatedComponent: vi.fn((component: any) => component),
    call: vi.fn(),
    event: vi.fn(),
  },
  useSharedValue: vi.fn((initial: any) => ({ value: initial })),
  useAnimatedStyle: vi.fn(() => ({})),
  useAnimatedScrollHandler: vi.fn(() => vi.fn()),
  withTiming: vi.fn((target: any) => target),
  withSpring: vi.fn((target: any) => target),
  withDelay: vi.fn((_delay: any, animation: any) => animation),
  withRepeat: vi.fn((animation: any) => animation),
  withSequence: vi.fn((...animations: any[]) => animations[animations.length - 1]),
  runOnJS: vi.fn((fn: any) => fn),
  interpolate: vi.fn((_value: any, _range: any[], output: any[]) => output[0]),
  Extrapolate: { CLAMP: "clamp" },
  FadeIn: { duration: vi.fn() },
  FadeOut: { duration: vi.fn() },
  SlideInLeft: { duration: vi.fn() },
  SlideOutRight: { duration: vi.fn() },
  Easing: {
    linear: vi.fn(),
    ease: vi.fn(),
    bezier: vi.fn(),
    in: vi.fn(),
    out: vi.fn(),
    inOut: vi.fn(),
  },
}));

vi.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: "GestureHandlerRootView",
  Gesture: {
    Pan: vi.fn(() => ({
      onStart: vi.fn().mockReturnThis(),
      onUpdate: vi.fn().mockReturnThis(),
      onEnd: vi.fn().mockReturnThis(),
    })),
    Tap: vi.fn(() => ({
      onEnd: vi.fn().mockReturnThis(),
    })),
    Race: vi.fn(),
    Simultaneous: vi.fn(),
  },
  GestureDetector: "GestureDetector",
  PanGestureHandler: "PanGestureHandler",
  TapGestureHandler: "TapGestureHandler",
  ScrollView: "ScrollView",
}));

vi.mock("@gorhom/bottom-sheet", () => ({
  default: "BottomSheet",
  BottomSheetView: "BottomSheetView",
  BottomSheetScrollView: "BottomSheetScrollView",
  BottomSheetBackdrop: "BottomSheetBackdrop",
  useBottomSheet: vi.fn(() => ({
    expand: vi.fn(),
    collapse: vi.fn(),
    close: vi.fn(),
    snapToIndex: vi.fn(),
    snapToPosition: vi.fn(),
  })),
}));

// ── Global test utilities ──────────────────────────────────────────────────

declare global {
  namespace Vi {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveCartConsistency(): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },
});

// ── Console noise suppression ──────────────────────────────────────────────
// Suppress known/expected console output in tests to keep output readable.
// These patterns are emitted by defensive code when given bad input.

const SUPPRESSED_PATTERNS = [
  "[Cart Delta]",
  "[Defensive]",
  "[RequestManager]",
  "[Cart Delta Safe]",
];

const originalWarn = console.warn;
const originalError = console.error;
const originalLog = console.log;
const originalDebug = console.debug;

beforeEach(() => {
  console.warn = (...args: any[]) => {
    const msg = String(args[0] ?? "");
    if (SUPPRESSED_PATTERNS.some((p) => msg.includes(p))) return;
    originalWarn.apply(console, args);
  };
  console.error = (...args: any[]) => {
    const msg = String(args[0] ?? "");
    if (SUPPRESSED_PATTERNS.some((p) => msg.includes(p))) return;
    originalError.apply(console, args);
  };
  console.log = (...args: any[]) => {
    const msg = String(args[0] ?? "");
    if (SUPPRESSED_PATTERNS.some((p) => msg.includes(p))) return;
    originalLog.apply(console, args);
  };
  console.debug = (...args: any[]) => {
    const msg = String(args[0] ?? "");
    if (SUPPRESSED_PATTERNS.some((p) => msg.includes(p))) return;
    originalDebug.apply(console, args);
  };
});

afterEach(() => {
  vi.clearAllMocks();
  // Restore console after each test
  console.warn = originalWarn;
  console.error = originalError;
  console.log = originalLog;
  console.debug = originalDebug;
});

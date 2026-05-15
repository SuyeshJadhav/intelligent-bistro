/**
 * ExecutionLog.tsx - Renders the deterministic system-style execution feedback.
 *
 * Design principles:
 * - Linear, monospace rendering
 * - Staggered animation entrance
 * - System console aesthetic
 * - Minimal visual noise
 * - Subtle opacity transitions
 *
 * Example output:
 * PROCESSING_INTENT...
 * VALIDATING_MENU...
 * UPDATING_STATE...
 * SYNC_COMPLETE
 */

import { formatExecutionLogEntry } from "@/lib/aiPresentation";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

interface ExecutionLogProps {
	entries: string[];
	isProcessing?: boolean;
}

const isDevelopment =
	typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

function AnimatedStatusText({ text }: { text: string }) {
	const presentation = formatExecutionLogEntry(text, { isDevelopment });
	const opacity = useSharedValue(0);

	useEffect(() => {
		opacity.value = 0;
		opacity.value = withTiming(1, { duration: 180 });
	}, [opacity, text]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
	}));

	return (
		<Animated.Text style={animatedStyle} className="font-mono text-xs text-muted-text">
			{`● ${presentation.label}`}
		</Animated.Text>
	);
}

export function ExecutionLog({
	entries,
	isProcessing = false,
}: ExecutionLogProps) {
	const [displayIndex, setDisplayIndex] = useState(-1);

	useEffect(() => {
		if (entries.length === 0) {
			setDisplayIndex(-1);
			return;
		}

		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | null = null;

		setDisplayIndex((previous) => {
			if (previous < 0) {
				return 0;
			}

			if (previous > entries.length - 1) {
				return entries.length - 1;
			}

			return previous;
		});

		const stepForward = () => {
			if (cancelled) {
				return;
			}

			setDisplayIndex((previous) => {
				const next = Math.min(previous + 1, entries.length - 1);
				if (next < entries.length - 1) {
					timer = setTimeout(stepForward, 220);
				}
				return next;
			});
		};

		timer = setTimeout(stepForward, 150);

		return () => {
			cancelled = true;
			if (timer) {
				clearTimeout(timer);
			}
		};
	}, [entries]);

	if (entries.length === 0 && !isProcessing) {
		return null;
	}

	const visibleEntry =
		displayIndex >= 0 && displayIndex < entries.length
			? entries[displayIndex]
			: undefined;
	const latestEntry = visibleEntry ?? entries[entries.length - 1] ?? "PROCESSING_INTENT...";

	return (
		<View className="self-start rounded-full bg-surface-elevated px-2.5 py-1">
			<AnimatedStatusText text={latestEntry} />
		</View>
	);
}

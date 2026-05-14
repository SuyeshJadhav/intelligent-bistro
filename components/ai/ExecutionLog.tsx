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

import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

interface ExecutionLogProps {
	entries: string[];
	isProcessing?: boolean;
}

function AnimatedLogEntry({
	text,
	index,
}: {
	text: string;
	index: number;
}) {
	const opacity = useSharedValue(0);
	const hasAnimated = useRef(false);

	useEffect(() => {
		if (!hasAnimated.current) {
			hasAnimated.current = true;
			const timer = setTimeout(() => {
				opacity.value = withTiming(1, { duration: 200 });
			}, index * 100);

			return () => clearTimeout(timer);
		}
	}, [index, opacity]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
	}));

	return (
		<Animated.Text
			style={animatedStyle}
			className="font-mono text-xs text-secondary-text"
		>
			{text}
		</Animated.Text>
	);
}

export function ExecutionLog({
	entries,
	isProcessing = false,
}: ExecutionLogProps) {
	if (entries.length === 0) {
		return null;
	}

	return (
		<View className="gap-1 rounded-lg border border-divider bg-surface-elevated px-3 py-2">
			{/* System label */}
			<Text className="mb-1 font-mono text-xs text-muted-text">
				EXECUTION LOG
			</Text>

			{/* Log entries */}
			{entries.map((entry, index) => (
				<AnimatedLogEntry key={`${entry}-${index}`} text={entry} index={index} />
			))}

			{/* Processing indicator */}
			{isProcessing && (
				<View className="mt-2 flex-row gap-1">
					<Text className="font-mono text-xs text-ai-accent">●</Text>
					<Text className="font-mono text-xs text-ai-accent">
						processing
					</Text>
				</View>
			)}
		</View>
	);
}

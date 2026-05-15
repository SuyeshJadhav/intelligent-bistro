/**
 * AIAssistantSheet.tsx - Main AI assistant bottom sheet.
 *
 * Architecture:
 * - Manages the complete message flow
 * - Handles API communication via RequestManager (with retry/debounce)
 * - Applies cart deltas via applyCartDelta
 * - Displays optimistic UI states
 * - Renders execution feedback
 *
 * State flow:
 * 1. User sends message
 * 2. Show optimistic user message bubble
 * 3. Request via RequestManager (handles retry, debounce, cancellation)
 * 4. Render execution log with animations
 * 5. Apply cart mutations from backend
 * 6. Show AI confirmation message
 */

import BottomSheet, { BottomSheetBackdrop, BottomSheetFooter, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BlurView } from "expo-blur";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Text,
	View
} from "react-native";
import Animated, {
	useAnimatedKeyboard,
	useAnimatedStyle
} from "react-native-reanimated";

import { useAIOrchestrator } from "@/hooks/useAIOrchestrator";
import { requestManager } from "@/lib/requestManager";
import { useAIStore } from "@/store/aiStore";

import { AIInput } from "./AIInput";
import { AIMessage } from "./AIMessage";
import { ExecutionLog } from "./ExecutionLog";

/**
 * Main AI Assistant Sheet Component
 *
 * Features:
 * - Premium floating translucent sheet
 * - Real-time execution feedback
 * - Optimistic UI updates
 * - Error handling with fallback messaging
 * - Smooth animations
 */
export function AIAssistantSheet() {
	// AI Store
	const isOpen = useAIStore((state) => state.isOpen);
	const isProcessing = useAIStore((state) => state.isProcessing);
	const messages = useAIStore((state) => state.messages);
	const executionLog = useAIStore((state) => state.executionLog);
	const closeAI = useAIStore((state) => state.closeAI);
	const lastError = useAIStore((state) => state.lastError);

	// Local state
	const scrollViewRef = useRef<any>(null);
	const bottomSheetRef = useRef<BottomSheet>(null);

	// Sync bottom sheet with isOpen state
	useEffect(() => {
		if (isOpen) {
			bottomSheetRef.current?.snapToIndex(0);
		} else {
			bottomSheetRef.current?.close();
		}
	}, [isOpen]);

	// Auto-scroll to latest messages
	useEffect(() => {
		const timer = setTimeout(() => {
			scrollViewRef.current?.scrollToEnd({ animated: true });
		}, 80);

		return () => clearTimeout(timer);
	}, [executionLog.length, isProcessing, messages.length]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			// Cancel any in-flight request when component unmounts
			requestManager.cancelRequest();
		};
	}, []);

	const keyboard = useAnimatedKeyboard();

	const innerStyle = useAnimatedStyle(() => ({
		paddingBottom: keyboard.height.value,
	}));

	const renderBackdrop = useCallback(
		(props: any) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				pressBehavior="close"
			/>
		),
		[]
	);

	const renderBackground = useCallback(
		({ style }: any) => (
			<View style={[style, { overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
				<BlurView intensity={80} tint="light" experimentalBlurMethod="dimezisBlurView" style={{ flex: 1, backgroundColor: "rgba(255, 255, 255, 0.85)" }} />
			</View>
		),
		[]
	);




	const renderFooter = useCallback(
		(props: any) => (
			<AIAssistantFooter {...props} innerStyle={innerStyle} />
		),
		[innerStyle]
	);

	return (
		<BottomSheet
			ref={bottomSheetRef}
			index={-1}
			snapPoints={["75%", "95%"]}
			enablePanDownToClose
			onClose={closeAI}
			backdropComponent={renderBackdrop}
			backgroundComponent={renderBackground}
			handleIndicatorStyle={{ backgroundColor: "#ccc", width: 40 }}
			enableDynamicSizing={false}
			footerComponent={renderFooter}
		>
			<View className="flex-1 flex-col">
				{/* Header */}
				<View className="flex-row items-center justify-between border-b border-divider px-6 py-4">
					<Text className="font-sans text-lg font-semibold text-primary-text">
						AI Assistant
					</Text>
				</View>

				{/* Messages scroll area */}
				<BottomSheetScrollView
					ref={scrollViewRef}
					className="flex-1 px-6 py-4"
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: 100 }}
				>
					{/* Initial state message */}
					{messages.length === 0 && !isProcessing && (
						<View className="gap-3">
							<Text className="font-sans text-base text-secondary-text">
								Welcome to the AI Assistant. Try commands like:
							</Text>
							<View className="gap-2">
								<Text className="font-mono text-sm text-muted-text">
									• Add two spicy chicken sandwiches
								</Text>
								<Text className="font-mono text-sm text-muted-text">
									• Remove the cola from my cart
								</Text>
								<Text className="font-mono text-sm text-muted-text">
									• Make that three salads instead
								</Text>
							</View>
						</View>
					)}

					{/* Messages */}
					{messages.map((msg, idx) => (
						<AIMessage
							key={idx}
							message={msg}
							isExecutingAction={
								isProcessing && msg.role === "ai" && idx === messages.length - 1
							}
						/>
					))}

					{/* Execution log */}
					{executionLog.length > 0 && (
						<View className="mt-4">
							<ExecutionLog
								entries={executionLog}
								isProcessing={isProcessing}
							/>
						</View>
					)}

					{/* Error message */}
					{lastError && !isProcessing && (
						<View className="mt-4 rounded-lg border border-error bg-surface-elevated px-3 py-2">
							<Text className="font-sans text-sm text-error">
								{lastError}
							</Text>
						</View>
					)}
				</BottomSheetScrollView>
			</View>
		</BottomSheet>
	);
}

function AIAssistantFooter(props: any) {
	const [input, setInput] = useState("");
	const { handleSend } = useAIOrchestrator(input, setInput);
	const isProcessing = useAIStore((state) => state.isProcessing);

	return (
		<BottomSheetFooter {...props} bottomInset={0}>
			<Animated.View style={[props.innerStyle, { backgroundColor: "rgba(255, 255, 255, 0.85)" }]}>
				<AIInput
					value={input}
					onChangeText={setInput}
					onSend={() => {
						void handleSend();
					}}
					isDisabled={isProcessing}
				/>
			</Animated.View>
		</BottomSheetFooter>
	);
}

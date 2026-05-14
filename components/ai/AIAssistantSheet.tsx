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

import { BlurView } from "expo-blur";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Dimensions,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	Text,
	View,
} from "react-native";
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop, BottomSheetFooter } from '@gorhom/bottom-sheet';
import Animated, {
	useAnimatedKeyboard,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";

import { applyCartDeltaSafe } from "@/lib/applyCartDelta";
import { parseAIResponse } from "@/lib/defensiveParsing";
import { requestManager } from "@/lib/requestManager";
import { useAIStore } from "@/store/aiStore";
import { useCartStore } from "@/store/cartStore";

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
	const screenHeight = Dimensions.get("window").height;

	// AI Store
	const isOpen = useAIStore((state) => state.isOpen);
	const isProcessing = useAIStore((state) => state.isProcessing);
	const messages = useAIStore((state) => state.messages);
	const executionLog = useAIStore((state) => state.executionLog);
	const closeAI = useAIStore((state) => state.closeAI);
	const setProcessing = useAIStore((state) => state.setProcessing);
	const appendLog = useAIStore((state) => state.appendLog);
	const clearLog = useAIStore((state) => state.clearLog);

	// Store actions to add AI response messages
	const addAIMessage = useAIStore((state) => {
		if (!state.sendMessage) {
			// Initialize if not present
			return () => { };
		}
		return state.sendMessage;
	});

	// Cart Store
	const cartItems = useCartStore((state) => state.items);

	// Local state
	const [input, setInput] = useState("");
	const [lastError, setLastError] = useState<string | null>(null);
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


	/**
	 * Main send handler - orchestrates the entire flow with production-grade reliability.
	 *
	 * Features:
	 * - Debounces rapid requests
	 * - Automatically retries on network errors
	 * - Cancels previous in-flight request
	 * - Defensive parsing of backend response
	 * - Graceful error handling
	 */
	const handleSend = useCallback(async () => {
		const prompt = input.trim();

		if (!prompt || isProcessing) {
			return;
		}

		try {
			// Clear previous errors and log
			setLastError(null);
			clearLog();

			// 1. Show optimistic user message
			const userMessage = { role: "user" as const, content: prompt };
			useAIStore.setState((state) => ({
				messages: [...state.messages, userMessage],
			}));

			// Clear input immediately for better UX
			setInput("");

			// 2. Start processing
			setProcessing(true);
			appendLog("PROCESSING_INTENT...");

			// 3. Send to backend API via RequestManager (handles retry, debounce)
			appendLog("VALIDATING_MENU...");

			const cartPayload = cartItems.map((item) => ({
				id: item.id,
				name: item.name,
				price: item.price,
				quantity: item.quantity,
			}));

			// Use RequestManager for production-grade reliability
			const response = await requestManager.sendWithRetry(
				prompt,
				cartPayload,
				(attempt, error) => {
					console.log(`[AIAssistant] Retry attempt ${attempt}: ${error.message}`);
					appendLog(`RETRYING... (${attempt})`);
				}
			);

			// 4. Defensively parse response
			const parsedResponse = parseAIResponse(response);
			if (!parsedResponse) {
				throw new Error("Backend response failed validation");
			}

			// 5. Show execution logs from backend
			for (const logEntry of parsedResponse.executionLog) {
				appendLog(logEntry);
				// Small delay between log entries for staggered visual effect
				await new Promise((resolve) => setTimeout(resolve, 150));
			}

			// 6. Apply cart mutations safely
			appendLog("APPLYING_MUTATIONS...");
			const { applied, failed } = applyCartDeltaSafe(parsedResponse.actions);

			if (failed > 0) {
				console.warn(`[AIAssistant] ${failed} cart actions failed to apply`);
			}

			// 7. Show AI response message
			const aiMessage = {
				role: "ai" as const,
				content: parsedResponse.confirmation,
			};

			useAIStore.setState((state) => ({
				messages: [...state.messages, aiMessage],
			}));

			// Mark completion
			appendLog("COMPLETE");
		} catch (error) {
			let errorMessage = "Something went wrong. Please try again.";
			let logEntry = "ERROR";

			if (error instanceof Error) {
				if (error.message.includes("offline") || error.message.includes("Offline")) {
					errorMessage =
						"You appear to be offline. Please check your connection.";
					logEntry = "OFFLINE_ERROR";
				} else if (error.message.includes("Too many requests")) {
					errorMessage = "Please wait before sending another message.";
					logEntry = "DEBOUNCE_ERROR";
				} else if (error.message.includes("timed out")) {
					errorMessage =
						"Request timed out. Backend may be slow or unreachable.";
					logEntry = "TIMEOUT_ERROR";
				} else if (error.message.includes("validation")) {
					errorMessage =
						"Backend returned invalid data. Please check backend logs.";
					logEntry = "VALIDATION_ERROR";
				} else {
					errorMessage = error.message;
				}
			}

			appendLog(logEntry);
			setLastError(errorMessage);

			// Add error message to chat
			const errorMessage_obj = {
				role: "ai" as const,
				content: `Error: ${errorMessage}`,
			};

			useAIStore.setState((state) => ({
				messages: [...state.messages, errorMessage_obj],
			}));

			console.error("[AIAssistant] Request failed:", error);
		} finally {
			setProcessing(false);
		}
	}, [
		input,
		isProcessing,
		clearLog,
		setProcessing,
		appendLog,
		cartItems,
	]);

	const renderFooter = useCallback(
		(props: any) => (
			<BottomSheetFooter {...props} bottomInset={0}>
				<Animated.View style={[innerStyle, { backgroundColor: "rgba(255, 255, 255, 0.85)" }]}>
					<AIInput
						value={input}
						onChangeText={setInput}
						onSend={handleSend}
						isDisabled={isProcessing}
					/>
				</Animated.View>
			</BottomSheetFooter>
		),
		[input, isProcessing, handleSend, innerStyle]
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

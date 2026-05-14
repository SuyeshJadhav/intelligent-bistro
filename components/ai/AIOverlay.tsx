import { BlurView } from "expo-blur";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Dimensions,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";

import { menuData } from "@/constants/menuData";
import { THEME } from "@/constants/theme";
import { useAIStore } from "@/store/aiStore";
import { useCartStore, type CartAction } from "@/store/cartStore";

import { ActionCard } from "./ActionCard";

function AnimatedLogLine({ line, index }: { line: string; index: number }) {
	const opacity = useSharedValue(0);

	useEffect(() => {
		const timer = setTimeout(() => {
			opacity.value = withTiming(1, { duration: 250 });
		}, index * 300);

		return () => {
			clearTimeout(timer);
		};
	}, [index, opacity]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
	}));

	return (
		<Animated.Text style={animatedStyle} className="mt-1 font-mono text-xs text-secondary-text">
			{line}
		</Animated.Text>
	);
}

export function AIOverlay() {
	const screenHeight = Dimensions.get("window").height;

	const isOpen = useAIStore((state) => state.isOpen);
	const isProcessing = useAIStore((state) => state.isProcessing);
	const messages = useAIStore((state) => state.messages);
	const executionLog = useAIStore((state) => state.executionLog);
	const closeAI = useAIStore((state) => state.closeAI);
	const sendMessage = useAIStore((state) => state.sendMessage);
	const setProcessing = useAIStore((state) => state.setProcessing);
	const appendLog = useAIStore((state) => state.appendLog);
	const clearLog = useAIStore((state) => state.clearLog);

	const addItem = useCartStore((state) => state.addItem);
	const removeItem = useCartStore((state) => state.removeItem);
	const updateQuantity = useCartStore((state) => state.updateQuantity);

	const [input, setInput] = useState("");
	const scrollViewRef = useRef<ScrollView>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const translateY = useSharedValue(screenHeight);
	const backdropProgress = useSharedValue(0);

	useEffect(() => {
		if (isOpen) {
			backdropProgress.value = withTiming(1, { duration: 200 });
			translateY.value = withSpring(0, {
				damping: 28,
				stiffness: 120,
				mass: 1.1,
			});
			return;
		}

		backdropProgress.value = withTiming(0, { duration: 180 });
		translateY.value = withSpring(screenHeight, {
			damping: 28,
			stiffness: 120,
			mass: 1.1,
		});
	}, [backdropProgress, isOpen, screenHeight, translateY]);

	useEffect(() => {
		const timer = setTimeout(() => {
			scrollViewRef.current?.scrollToEnd({ animated: true });
		}, 80);

		return () => {
			clearTimeout(timer);
		};
	}, [executionLog.length, isProcessing, messages.length]);

	useEffect(() => {
		return () => {
			timeoutRef.current.forEach((timerId) => clearTimeout(timerId));
		};
	}, []);

	const backdropStyle = useAnimatedStyle(() => ({
		opacity: backdropProgress.value * 0.4,
	}));

	const panelStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }],
		height: screenHeight * 0.75,
	}));

	const applyActions = useCallback(
		(actions: CartAction[]) => {
			actions.forEach((action) => {
				if (action.type === "ADD_ITEM") {
					const menuItem = menuData.find((item) => item.id === action.itemId);

					addItem({
						id: action.itemId,
						name: action.name,
						price: action.price,
						quantity: action.quantity,
						description: menuItem?.description ?? "AI-assisted menu update",
						imageUrl: menuItem?.imageUrl ?? "",
					});
				}

				if (action.type === "REMOVE_ITEM") {
					removeItem(action.itemId);
				}

				if (action.type === "UPDATE_QUANTITY") {
					updateQuantity(action.itemId, action.quantity);
				}
			});
		},
		[addItem, removeItem, updateQuantity],
	);

	const handleSend = () => {
		const prompt = input.trim();

		if (!prompt) {
			return;
		}

		setInput("");
		sendMessage(prompt);
		setProcessing(true);
		clearLog();

		const queue = (delay: number, callback: () => void) => {
			const timerId = setTimeout(callback, delay);
			timeoutRef.current.push(timerId);
		};

		queue(0, () => appendLog("PROCESSING_INTENT..."));
		queue(600, () => appendLog("VALIDATING_MENU..."));
		queue(1200, () => appendLog("UPDATING_STATE..."));
		queue(1800, () => appendLog("SYNC_COMPLETE"));

		queue(2200, () => {
			const actions: CartAction[] = [
				{
					type: "ADD_ITEM",
					itemId: "spicy-chicken",
					quantity: 2,
					name: "Spicy Chicken",
					price: 9,
				},
			];

			applyActions(actions);
			setProcessing(false);
			clearLog();

			useAIStore.setState((state) => ({
				messages: [
					...state.messages,
					{
						role: "ai",
						content: "Order updated. I added 2x Spicy Chicken.",
						actions,
					},
				],
			}));
		});
	};

	return (
		<View pointerEvents={isOpen ? "auto" : "none"} className="absolute inset-0 z-50">
			<Animated.View className="absolute inset-0 bg-primary-text" style={backdropStyle}>
				<Pressable className="h-full w-full" onPress={closeAI} />
			</Animated.View>

			<Animated.View
				style={panelStyle}
				className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-tl-3xl rounded-tr-3xl border-t border-divider bg-surface/95">
				<BlurView tint="light" intensity={80} className="absolute inset-0" />

				<KeyboardAvoidingView 
					className="flex-1" 
					behavior="padding"
				>
					<View className="px-4 pb-3 pt-4">
						<View className="flex-row items-center justify-between">
							<Text className="font-mono text-xs text-muted-text">AI ASSISTANT</Text>

							<Pressable
								onPress={closeAI}
								className="h-8 w-8 items-center justify-center rounded-lg border border-divider">
								<Text className="font-sans text-base text-secondary-text">✕</Text>
							</Pressable>
						</View>
					</View>

					<View className="border-b border-divider" />

					<ScrollView
						ref={scrollViewRef}
						className="flex-1 px-4 pt-4"
						showsVerticalScrollIndicator={false}
						contentContainerClassName="pb-4">
						<View className="gap-3">
							{messages.map((message, index) => (
								<View
									key={`${message.role}-${index}`}
									className={message.role === "user" ? "items-end" : "items-start"}>
									<View
										className={
											message.role === "user"
												? "max-w-[75%] rounded-2xl rounded-tr-sm bg-primary-text px-4 py-3"
												: "max-w-[80%] rounded-2xl rounded-tl-sm border border-divider bg-surface px-4 py-3"
										}>
										<Text
											className={
												message.role === "user"
													? "font-sans text-sm text-surface"
													: "font-sans text-sm text-primary-text"
											}>
											{message.content}
										</Text>

										{message.role === "ai" && message.actions?.length ? (
											<ActionCard actions={message.actions} />
										) : null}
									</View>
								</View>
							))}
						</View>

						{isProcessing ? (
							<View className="mx-4 my-2 rounded-xl border border-divider bg-surface-container p-3">
								<View className="flex-row items-center gap-2">
									<View className="h-2 w-2 animate-pulse rounded-full bg-ai-accent" />
									<Text className="font-mono text-xs text-muted-text">EXECUTING</Text>
								</View>

								{executionLog.map((entry, index) => (
									<AnimatedLogLine key={`${entry}-${index}`} line={entry} index={index} />
								))}
							</View>
						) : null}
					</ScrollView>

					<View className="border-t border-divider p-4">
						<View className="flex-row items-end gap-3">
								<TextInput
									value={input}
									onChangeText={setInput}
									placeholder="Ask me anything..."
									placeholderTextColor={THEME.colors["muted-text"]}
									className="flex-1 rounded-2xl border border-divider bg-surface px-4 py-3 font-sans text-base text-primary-text"
									multiline
									onSubmitEditing={handleSend}
									blurOnSubmit={false}
								/>

								<Pressable
									onPress={handleSend}
									className={`h-11 w-11 items-center justify-center rounded-2xl ${input.trim().length > 0
										? "bg-ai-accent"
										: "border border-divider bg-surface"
										}`}>
									<Text className="font-sans text-lg font-semibold text-primary-text">↑</Text>
								</Pressable>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Animated.View>
		</View>
	);
}

/**
 * AIInput.tsx - Text input for natural language commands.
 *
 * Features:
 * - Minimalist design
 * - Disabled while processing
 * - Clear send button state
 * - Monospace font to match system aesthetic
 */

import { Pressable, Text, TextInput, View } from "react-native";

interface AIInputProps {
	value: string;
	onChangeText: (text: string) => void;
	onSend: () => void;
	isDisabled?: boolean;
	placeholder?: string;
}

export function AIInput({
	value,
	onChangeText,
	onSend,
	isDisabled = false,
	placeholder = "Type your order...",
}: AIInputProps) {
	const isEmpty = value.trim().length === 0;
	const shouldDisableSend = isEmpty || isDisabled;

	return (
		<View className="gap-2 bg-background px-3 py-3">
			<View className="flex-row items-center gap-2 rounded-xl border border-divider bg-surface px-3 py-2">
				{/* Text input */}
				<TextInput
					value={value}
					onChangeText={onChangeText}
					placeholder={placeholder}
					placeholderTextColor="#9B9B9B"
					editable={!isDisabled}
					className="flex-1 font-sans text-base text-primary-text"
					multiline
					maxLength={200}
				/>

				{/* Send button */}
				<Pressable
					onPress={onSend}
					disabled={shouldDisableSend}
					className={`rounded-lg px-3 py-1 ${shouldDisableSend
							? "bg-divider"
							: "bg-ai-accent active:opacity-75"
						}`}
				>
					<Text
						className={`font-mono text-sm font-semibold ${shouldDisableSend
								? "text-muted-text"
								: "text-primary-text"
							}`}
					>
						Send
					</Text>
				</Pressable>
			</View>

			{/* Character count hint */}
			<Text className="text-right font-mono text-xs text-muted-text">
				{value.length}/200
			</Text>
		</View>
	);
}

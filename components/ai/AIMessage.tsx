/**
 * AIMessage.tsx - Renders individual user/AI messages.
 *
 * Design:
 * - Premium minimal styling
 * - Clear role differentiation (user vs AI)
 * - Monospace for code/feedback
 * - Subtle visual hierarchy
 */

import type { Message } from "@/store/aiStore";
import { Text, View } from "react-native";

interface AIMessageProps {
	message: Message;
	isExecutingAction?: boolean;
}

export function AIMessage({
	message,
	isExecutingAction = false,
}: AIMessageProps) {
	const isUser = message.role === "user";

	return (
		<View
			className={`mb-4 gap-2 ${isUser ? "items-end" : "items-start"}`}
		>
			{/* Message bubble */}
			<View
				className={`max-w-xs rounded-2xl px-4 py-3 ${isUser
						? "bg-primary-text"
						: "border border-divider bg-surface-elevated"
					}`}
			>
				<Text
					className={`font-sans text-base ${isUser ? "text-background" : "text-primary-text"
						}`}
				>
					{message.content}
				</Text>
			</View>

			{/* Loading indicator for AI messages during processing */}
			{!isUser && isExecutingAction && (
				<View className="flex-row gap-1">
					<View className="h-1.5 w-1.5 rounded-full bg-ai-accent" />
					<View className="h-1.5 w-1.5 rounded-full bg-ai-accent opacity-60" />
					<View className="h-1.5 w-1.5 rounded-full bg-ai-accent opacity-30" />
				</View>
			)}
		</View>
	);
}

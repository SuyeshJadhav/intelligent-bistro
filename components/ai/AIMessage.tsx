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
	const aiLines = isUser
		? []
		: message.content
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);

	const isBulletLine = (line: string) => /^(?:•|-)\s+/.test(line);

	const getLineText = (line: string) => line.replace(/^(?:•|-)\s+/, "").trim();

	return (
		<View
			className={`mb-4 gap-2 ${isUser ? "items-end" : "items-start"}`}
		>
			{/* Message bubble */}
			<View
				className={`max-w-[80%] rounded-2xl px-4 py-3 ${isUser
					? "bg-primary-text"
					: "border border-divider bg-surface-elevated"
					}`}
			>
				{isUser ? (
					<Text className="font-sans text-base leading-6 text-background">
						{message.content}
					</Text>
				) : (
					<View className="gap-1.5">
						{aiLines.length > 0 ? (
							aiLines.map((line, index) => {
								if (isBulletLine(line)) {
									return (
										<View key={`bullet-${index}`} className="flex-row items-start gap-2">
											<View className="mt-2 h-1.5 w-1.5 rounded-full bg-secondary-text" />
											<Text className="flex-1 font-sans text-base leading-6 text-primary-text">
												{getLineText(line)}
											</Text>
										</View>
									);
								}

								return (
									<Text
										key={`line-${index}`}
										className="font-sans text-base leading-6 text-primary-text"
									>
										{line}
									</Text>
								);
							})
						) : (
							<Text className="font-sans text-base leading-6 text-primary-text">
								{message.content}
							</Text>
						)}
					</View>
				)}
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

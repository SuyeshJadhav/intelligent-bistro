import { Text, View } from "react-native";

import type { CartAction } from "@/store/cartStore";

interface ActionCardProps {
	actions: CartAction[];
}

const formatPrice = (value: number) => `$${value.toFixed(2)}`;

export function ActionCard({ actions }: ActionCardProps) {
	return (
		<View className="mt-2 rounded-xl border border-divider bg-background p-3">
			<View className="border-l-2 border-ai-accent pl-3">
				<Text className="font-mono text-xs text-muted-text">ORDER UPDATED</Text>

				<View className="mt-2 gap-1">
					{actions.map((action, index) => (
						<Text
							key={`${action.type}-${action.itemId}-${index}`}
							className="font-mono text-sm text-primary-text">
							{`${action.quantity}× ${action.name}  +${formatPrice(action.price * action.quantity)}`}
						</Text>
					))}
				</View>
			</View>
		</View>
	);
}

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { CartItem as CartItemType } from '../../store/cartStore';

type Props = {
	item: CartItemType;
	onUpdateQuantity: (id: string, qty: number) => void;
	onRemove: (id: string) => void;
};

export default function CartItem({ item, onUpdateQuantity, onRemove }: Props) {
	const onDecrease = () => {
		const next = item.quantity - 1;
		if (next <= 0) return onRemove(item.id);
		onUpdateQuantity(item.id, next);
	};

	const onIncrease = () => onUpdateQuantity(item.id, item.quantity + 1);

	return (
		<View className="flex-row items-center justify-between py-4 border-b border-divider">
			<View className="flex-1">
				<Text className="font-sans font-medium text-base text-primary-text">{item.name}</Text>
				<Text className="font-mono text-sm text-muted-text mt-0.5">${item.price.toFixed(2)}</Text>
			</View>

			<View className="flex-row items-center space-x-3 mr-4">
				<TouchableOpacity
					onPress={onDecrease}
					className="w-8 h-8 border border-divider rounded-lg items-center justify-center"
				>
					<Text className="text-primary-text">−</Text>
				</TouchableOpacity>

				<Text className="font-mono text-base text-primary-text text-center min-w-[24px]">{item.quantity}</Text>

				<TouchableOpacity
					onPress={onIncrease}
					className="w-8 h-8 bg-primary-text rounded-lg items-center justify-center"
				>
					<Text className="text-white">+</Text>
				</TouchableOpacity>
			</View>

			<View className="w-20 items-end">
				<Text className="font-mono text-sm text-primary-text">${(item.price * item.quantity).toFixed(2)}</Text>
			</View>
		</View>
	);
}

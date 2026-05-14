import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import type { MenuItem } from '@/constants/menuData';
import { useCartStore } from '@/store/cartStore';

type MenuCardProps = {
	item: MenuItem;
};

export function MenuCard({ item }: MenuCardProps) {
	const addItem = useCartStore((state) => state.addItem);
	const updateQuantity = useCartStore((state) => state.updateQuantity);
	const quantity = useCartStore(
		(state) => state.items.find((i) => i.id === item.id)?.quantity ?? 0
	);

	const handleAdd = () => {
		const { category, ...cartItem } = item;
		addItem({ ...cartItem, quantity: 1 });
	};

	const handleIncrement = () => {
		updateQuantity(item.id, quantity + 1);
	};

	const handleDecrement = () => {
		updateQuantity(item.id, quantity - 1);
	};

	return (
		<View className="overflow-hidden rounded-2xl border border-divider bg-surface">
			<Image
				source={{ uri: item.imageUrl }}
				contentFit="cover"
				className="aspect-[4/3] w-full"
			/>

			<View className="p-6">
				<Text className="font-sans text-xl font-semibold text-primary-text">{item.name}</Text>
				<Text className="mt-1 font-sans text-sm text-secondary-text">{item.description}</Text>

				<View className="mt-4 flex-row items-center justify-between">
					<Text className="font-mono text-base text-primary-text">${item.price.toFixed(2)}</Text>

					{quantity > 0 ? (
						<View className="flex-row items-center space-x-4">
							<Pressable
								onPress={handleDecrement}
								className="h-9 w-9 items-center justify-center rounded-full bg-surface-secondary">
								<Text className="text-xl leading-none text-primary-text">−</Text>
							</Pressable>
							<Text className="min-w-[24px] text-center font-sans text-base font-semibold text-primary-text">
								{quantity}
							</Text>
							<Pressable
								onPress={handleIncrement}
								className="h-9 w-9 items-center justify-center rounded-full bg-surface-secondary">
								<Text className="text-xl leading-none text-primary-text">+</Text>
							</Pressable>
						</View>
					) : (
						<Pressable
							onPress={handleAdd}
							className="h-9 w-9 items-center justify-center rounded-full bg-surface-secondary">
							<Text className="text-xl leading-none text-primary-text">+</Text>
						</Pressable>
					)}
				</View>
			</View>
		</View>
	);
}
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import type { MenuItem } from '@/constants/menuData';
import { useCartStore } from '@/store/cartStore';

type MenuCardProps = {
	item: MenuItem;
};

export function MenuCard({ item }: MenuCardProps) {
	const addItem = useCartStore((state) => state.addItem);

	const handleAdd = () => {
		const { category, ...cartItem } = item;
		addItem({ ...cartItem, quantity: 1 });
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

					<Pressable
						onPress={handleAdd}
						className="h-9 w-9 items-center justify-center rounded-full bg-primary-text">
						<Text className="text-lg leading-none text-white">+</Text>
					</Pressable>
				</View>
			</View>
		</View>
	);
}
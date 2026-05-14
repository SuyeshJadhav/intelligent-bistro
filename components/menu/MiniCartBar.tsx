import { ReactNode, useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useCartStore } from '@/store/cartStore';
import { useCart } from '../cart/CartProvider';

type MiniCartBarProps = {
	rightContent?: ReactNode;
};

export function MiniCartBar({ rightContent }: MiniCartBarProps) {
	const totalItems = useCartStore((state) => state.totalItems);
	const { openCart } = useCart();
	const translateY = useSharedValue(24);
	const opacity = useSharedValue(0);

	useEffect(() => {
		translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
		opacity.value = withSpring(1, { damping: 18, stiffness: 180 });
	}, [opacity, translateY]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }],
		opacity: opacity.value,
	}));

	if (totalItems <= 0) {
		return null;
	}

	return (
		<Animated.View className="absolute bottom-6 left-6 right-6 z-20" style={animatedStyle}>
			<View className="flex-row items-center justify-between rounded-2xl bg-primary-text px-4 py-4">
				<Text className="font-mono text-sm text-white">{totalItems} items</Text>

				<View className="flex-row items-center gap-3">
					<Pressable onPress={openCart}>
						<Text className="font-sans text-sm font-medium text-white">View Cart →</Text>
					</Pressable>

					{rightContent}
				</View>
			</View>
		</Animated.View>
	);
}
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Text, TouchableOpacity, View, Alert } from 'react-native';
import { THEME } from '../../constants/theme';
import { useCartStore } from '../../store/cartStore';
import CartItem from './CartItem';

export type CartSheetRef = {
	expand: () => void;
	close: () => void;
};

const CartSheet = forwardRef<CartSheetRef, object>((_props, ref) => {
	const bottomSheetRef = useRef<BottomSheetMethods | null>(null);
	const items = useCartStore((s) => s.items);
	const totalItems = useCartStore((s) => s.totalItems);
	const totalPrice = useCartStore((s) => s.totalPrice);
	const updateQuantity = useCartStore((s) => s.updateQuantity);
	const removeItem = useCartStore((s) => s.removeItem);

	useImperativeHandle(ref, () => ({
		expand: () => bottomSheetRef.current?.snapToIndex?.(0),
		close: () => bottomSheetRef.current?.close(),
	}), []);

	const snapPoints = ['50%', '95%'];

	const onConfirm = useCallback(() => {
		Alert.alert(
			'Order placed!',
			'Your food is on its way.',
			[
				{
					text: 'OK',
					onPress: () => {
						useCartStore.getState().clearCart();
						bottomSheetRef.current?.close();
					},
				},
			]
		);
	}, []);

	const handleUpdateQuantity = (id: string, qty: number) => updateQuantity(id, qty);
	const handleRemove = (id: string) => removeItem(id);

	return (
		<BottomSheet
			ref={bottomSheetRef}
			index={-1}
			snapPoints={snapPoints}
			enableDynamicSizing={false}
			enablePanDownToClose
			backgroundStyle={{
				backgroundColor: THEME.colors.surface,
				borderTopLeftRadius: THEME.spacing.md,
				borderTopRightRadius: THEME.spacing.md,
			}}
			handleIndicatorStyle={{
				backgroundColor: THEME.colors.divider,
				width: THEME.spacing.base * 5,
			}}
		>
			<View className="flex-1">
				<View className="px-6 pb-3 pt-1">
					<View className="border-b border-divider pb-4">
						<Text className="font-sans font-semibold text-2xl text-primary-text">Your Order</Text>
						<Text className="font-mono text-sm text-muted-text">{totalItems} ITEMS</Text>
					</View>
				</View>

				{items.length === 0 ? (
					<BottomSheetScrollView
						style={{ flex: 1 }}
						contentContainerStyle={{ flexGrow: 1, paddingHorizontal: THEME.spacing.md, paddingBottom: THEME.spacing.md }}
					>
						<View className="flex-1 items-center justify-center">
							<Text className="text-primary-text text-4xl">—</Text>
							<Text className="font-sans text-base text-secondary-text mt-2">Your order is empty.</Text>
							<Text className="font-sans text-sm text-muted-text mt-1">Start by browsing the menu.</Text>
						</View>
					</BottomSheetScrollView>
				) : (
					<BottomSheetScrollView
						style={{ flex: 1 }}
						contentContainerStyle={{ paddingHorizontal: THEME.spacing.md, paddingBottom: THEME.spacing.md }}
					>
						{items.map((it) => (
							<CartItem
								key={it.id}
								item={it}
								onUpdateQuantity={handleUpdateQuantity}
								onRemove={handleRemove}
							/>
						))}
					</BottomSheetScrollView>
				)}

				<View className="px-6 pt-3 pb-6">
					<View className="border-t border-divider pt-4">
						<View className="flex-row justify-between items-center mb-4">
							<Text className="font-sans text-base text-secondary-text">Total</Text>
							<Text className="font-mono text-xl font-semibold text-primary-text">${totalPrice.toFixed(2)}</Text>
						</View>

						<TouchableOpacity
							onPress={onConfirm}
							className="w-full bg-primary-text rounded-2xl h-14 items-center justify-center"
						>
							<Text className="font-sans font-semibold text-white">Confirm Order</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</BottomSheet>
	);
});

CartSheet.displayName = 'CartSheet';

export default CartSheet;

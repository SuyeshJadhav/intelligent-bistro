import React, { createContext, useContext, useRef } from 'react';
import type { CartSheetRef } from './CartSheet';
import CartSheet from './CartSheet';

type CartContextType = {
	openCart: () => void;
	closeCart: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const sheetRef = useRef<CartSheetRef | null>(null);

	return (
		<CartContext.Provider
			value={{
				openCart: () => sheetRef.current?.expand(),
				closeCart: () => sheetRef.current?.close(),
			}}
		>
			{children}
			<CartSheet ref={sheetRef} />
		</CartContext.Provider>
	);
};

export function useCart() {
	const ctx = useContext(CartContext);
	if (!ctx) throw new Error('useCart must be used within CartProvider');
	return ctx;
}

import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryPills } from '@/components/menu/CategoryPills';
import { MenuCard } from '@/components/menu/MenuCard';
import { MiniCartBar } from '@/components/menu/MiniCartBar';
import { SearchBar } from '@/components/menu/SearchBar';
import { menuCategories, menuData } from '@/constants/menuData';
import { useAIStore } from '@/store/aiStore';
import { useCartStore } from '@/store/cartStore';

function AIButton({ compact = false, onPress }: { compact?: boolean; onPress: () => void }) {
	return (
		<Pressable
			onPress={onPress}
			className={`items-center justify-center rounded-full bg-ai-accent ${compact ? 'h-12 w-12' : 'h-14 w-14'
				}`}>
			<Text className="font-sans text-lg font-semibold text-primary-text">✦</Text>
		</Pressable>
	);
}

export default function Index() {
	const [activeCategory, setActiveCategory] = useState('All');
	const [query, setQuery] = useState('');
	const totalItems = useCartStore((state) => state.totalItems);
	const openAI = useAIStore((state) => state.openAI);

	const filteredItems = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		return menuData.filter((item) => {
			const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
			const matchesQuery =
				normalizedQuery.length === 0 || item.name.toLowerCase().includes(normalizedQuery);

			return matchesCategory && matchesQuery;
		});
	}, [activeCategory, query]);

	const hasCartItems = totalItems > 0;

	return (
		<SafeAreaView edges={['top']} className="flex-1 bg-background">
			<StatusBar style="light" />

			<View className="px-6 pt-4">
				<Text className="font-sans text-[32px] font-semibold text-primary-text">Good evening.</Text>
				<Text className="mt-1 font-sans text-base text-secondary-text">What are you having?</Text>

				<View className="mt-4">
					<SearchBar value={query} onChangeText={setQuery} />
				</View>
			</View>

			<ScrollView
				className="flex-1"
				stickyHeaderIndices={[0]}
				nestedScrollEnabled
				showsVerticalScrollIndicator={false}>
				<View className="z-10 bg-background py-4">
					<View className="px-6">
						<CategoryPills
							categories={Array.from(menuCategories)}
							activeCategory={activeCategory}
							onSelect={setActiveCategory}
						/>
					</View>
				</View>

				<View className="px-6">
					<View className="gap-4">
						{filteredItems.map((item) => (
							<MenuCard key={item.id} item={item} />
						))}

						{filteredItems.length === 0 ? (
							<View className="rounded-2xl border border-divider bg-surface px-6 py-8">
								<Text className="font-sans text-base font-medium text-primary-text">
									No dishes found.
								</Text>
								<Text className="mt-1 font-sans text-sm text-secondary-text">
									Try a different category or search term.
								</Text>
							</View>
						) : null}
					</View>

					<View className="h-40" />
				</View>
			</ScrollView>

			{hasCartItems ? <MiniCartBar rightContent={<AIButton compact onPress={openAI} />} /> : null}

			{!hasCartItems ? (
				<View className="absolute bottom-6 right-6 z-20">
					<AIButton onPress={openAI} />
				</View>
			) : null}
		</SafeAreaView>
	);
}
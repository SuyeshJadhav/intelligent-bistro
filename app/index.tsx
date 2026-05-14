import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Animated, {
	Extrapolation,
	interpolate,
	useAnimatedScrollHandler,
	useAnimatedStyle,
	useSharedValue,
} from 'react-native-reanimated';

import { CategoryPills } from '@/components/menu/CategoryPills';
import { MenuCard } from '@/components/menu/MenuCard';
import { MiniCartBar } from '@/components/menu/MiniCartBar';
import { SearchBar } from '@/components/menu/SearchBar';
import { menuCategories, menuData } from '@/constants/menuData';
import { useAIStore } from '@/store/aiStore';
import { useCartStore } from '@/store/cartStore';

function getGreeting(hour: number) {
	if (hour < 12) {
		return 'Good morning.';
	}

	if (hour < 17) {
		return 'Good afternoon.';
	}

	return 'Good evening.';
}

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
	const [currentTime, setCurrentTime] = useState(() => new Date());
	const totalItems = useCartStore((state) => state.totalItems);
	const openAI = useAIStore((state) => state.openAI);

	// Reanimated: shared scroll state and handler
	const scrollY = useSharedValue(0);

	const onScroll = useAnimatedScrollHandler((event) => {
		scrollY.value = event.contentOffset.y;
	});

	const greetingStyle = useAnimatedStyle(() => ({
		opacity: interpolate(scrollY.value, [0, 80], [1, 0], Extrapolation.CLAMP),
		transform: [{ translateY: interpolate(scrollY.value, [0, 80], [0, -20], Extrapolation.CLAMP) }],
	}));

	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 60000);

		return () => clearInterval(timer);
	}, []);



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
	const greeting = getGreeting(currentTime.getHours());

	return (
		<SafeAreaView edges={['top']} className="flex-1 bg-background">
			<StatusBar style="light" />

			<Animated.ScrollView
				onScroll={onScroll}
				scrollEventThrottle={16}
				className="flex-1"
				nestedScrollEnabled
				showsVerticalScrollIndicator={false}
				removeClippedSubviews={false}
				stickyHeaderIndices={[1]}
			>
				{/* Greeting at top of scroll content */}
				<Animated.View style={[greetingStyle, { paddingHorizontal: 24, paddingTop: 16 }]}>
					<Text className="font-sans text-[32px] font-semibold text-primary-text">{greeting}</Text>
					<Text className="mt-1 font-sans text-base text-secondary-text">What are you having?</Text>
				</Animated.View>

				{/* Sticky header: search + filters */}
				<View className="bg-background" collapsable={false} style={{ zIndex: 20, elevation: 12 }}>
					<View className="px-6 mt-2 py-2 bg-background" style={{ zIndex: 21 }}>
						<SearchBar value={query} onChangeText={setQuery} />
					</View>

					<View className="px-6 pb-2 bg-background" style={{ zIndex: 21 }}>
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
			</Animated.ScrollView>

			{hasCartItems ? <MiniCartBar rightContent={<AIButton compact onPress={openAI} />} /> : null}

			{!hasCartItems ? (
				<View className="absolute bottom-6 right-6 z-20">
					<AIButton onPress={openAI} />
				</View>
			) : null}
		</SafeAreaView>
	);
}
import { Pressable, ScrollView, Text, View } from 'react-native';

type CategoryPillsProps = {
	categories: string[];
	activeCategory: string;
	onSelect: (category: string) => void;
};

export function CategoryPills({ categories, activeCategory, onSelect }: CategoryPillsProps) {
	return (
		<ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
			<View className="flex-row gap-2 pr-6">
				{categories.map((category) => {
					const isActive = category === activeCategory;

					return (
						<Pressable
							key={category}
							onPress={() => onSelect(category)}
							className={`rounded-full border px-4 py-2 ${isActive
								? 'border-primary-text bg-primary-text'
								: 'border-divider bg-surface'
								}`}>
							<Text
								className={`font-sans text-sm ${isActive ? 'font-medium text-white' : 'text-secondary-text'
									}`}>
								{category}
							</Text>
						</Pressable>
					);
				})}
			</View>
		</ScrollView>
	);
}
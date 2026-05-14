import { Text, TextInput, View } from 'react-native';

import { THEME } from '@/constants/theme';

type SearchBarProps = {
	value: string;
	onChangeText: (text: string) => void;
};

export function SearchBar({ value, onChangeText }: SearchBarProps) {
	return (
		<View className="flex-row items-center rounded-2xl border border-divider bg-surface px-4 py-[14px]">
			<Text className="mr-3 font-sans text-base text-muted-text">⌕</Text>
			<TextInput
				value={value}
				onChangeText={onChangeText}
				placeholder="Search menu..."
				placeholderTextColor={THEME.colors['muted-text']}
				className="flex-1 font-sans text-base text-primary-text"
			/>
		</View>
	);
}
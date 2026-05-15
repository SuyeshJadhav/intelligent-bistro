import { useAIStore } from '@/store/aiStore';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

export default function ClarificationPrompt() {
	const choices = useAIStore((s) => s.clarificationChoices ?? []);
	const accept = useAIStore((s) => (s as any).acceptClarification);

	if (!choices || choices.length === 0) return null;

	return (
		<View style={{ padding: 12 }}>
			<Text style={{ fontWeight: '600', marginBottom: 8 }}>Please confirm which item you meant:</Text>
			{choices.map((c: any, idx: number) => (
				<Pressable
					key={idx}
					onPress={() => accept(c)}
					style={{ padding: 10, backgroundColor: '#efefef', marginBottom: 6, borderRadius: 6 }}
				>
					<Text>{c.label ?? c.raw} {c.confidence ? `(${Math.round(c.confidence * 100)}%)` : ''}</Text>
				</Pressable>
			))}
		</View>
	);
}

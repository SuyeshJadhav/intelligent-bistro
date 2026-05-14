/** @type {import('tailwindcss').Config} */
module.exports = {
	presets: [require('nativewind/preset')],
	content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
	theme: {
		extend: {
			colors: {
				background: '#F6F6F3',
				surface: '#FFFFFF',
				'surface-container': '#F1EDEC',
				'surface-elevated': '#FCFCFA',
				'surface-secondary': '#F0F0EC',
				'primary-text': '#111111',
				'secondary-text': '#666666',
				'muted-text': '#9B9B9B',
				divider: '#ECECE7',
				'ai-accent': '#D9FF3F',
				error: '#BA1A1A',
			},
			fontFamily: {
				sans: ['Inter_400Regular', 'Inter_500Medium', 'Inter_600SemiBold'],
				mono: ['JetBrainsMono_500Medium', 'JetBrainsMono_600SemiBold'],
			},
			borderRadius: {
				sm: '0.25rem',
				md: '0.75rem',
				lg: '1rem',
				xl: '1.5rem',
				'2xl': '1.5rem',
				full: '9999px',
			},
			spacing: {
				base: '8px',
				xs: '4px',
				sm: '12px',
				md: '24px',
				lg: '48px',
				xl: '80px',
				'container-margin': '24px',
				gutter: '16px',
			},
		},
	},
};
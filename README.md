# Intelligent Bistro 🍔🤖

Intelligent Bistro is a high-fidelity mobile application that redefines the restaurant ordering experience. It combines a visually stunning, premium menu browsing interface with a state-of-the-art conversational AI assistant. Users can seamlessly order food using natural language (e.g., "Add two spicy chicken sandwiches and a large water"), and the AI interprets the intent to automatically update a highly responsive shopping cart in real-time.

[**Watch the Loom Walkthrough here**](#) *(Link coming soon)*

## Architecture Overview

The app operates on a deterministic, robust pipeline:
**Natural Language → Structured JSON → Deterministic Zustand Mutations**

1. The AI processes natural language via Google's Gemini API.
2. It outputs strictly validated JSON matching our action schemas (`ADD_ITEM`, `REMOVE_ITEM`, `UPDATE_QUANTITY`).
3. These structured intents are parsed defensively and applied via robust state management (Zustand), guaranteeing that the app never crashes from AI hallucinations and handles malformed data gracefully.

## Tech Stack

- **Frontend:** React Native, Expo, Expo Router
- **Styling:** NativeWind (Tailwind CSS for React Native), `@gorhom/bottom-sheet`, `expo-blur`
- **State Management:** Zustand
- **Backend:** Node.js, Express
- **AI Integration:** Google Gemini API (`@google/genai`)
- **Testing:** Vitest (Unit, Integration, and Snapshot tests)

## Prerequisites

- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- Google Gemini API Key

## Running Locally on Your Device

Want to test Intelligent Bistro on your own phone or local emulator? Follow these instructions to spin up the backend server and start the React Native app.

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd intelligent-bistro
```

### 2. Install dependencies
Install dependencies in the root directory (this covers both frontend and backend).
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory based on `.env.example` (or configure the following):
```env
# If using a physical device via Expo Go, replace `localhost` with your computer's local IP address (e.g., 192.168.1.X)
EXPO_PUBLIC_API_URL=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Start the Backend Server
The backend handles the AI intent parsing and menu context injection.
```bash
# In a new terminal window:
npm run dev --prefix server
# or run `npm run dev` in the root if your scripts are configured to run both
```
*(The server runs on port 3000 by default)*

### 5. Start the Expo Application
Run the Expo application in your simulator or scan the QR code with the Expo Go app on your physical device.
```bash
# In your main terminal window:
npx expo start
```
- **Physical Device:** Download the "Expo Go" app on iOS or Android, and scan the QR code shown in the terminal.
- **Simulator:** Press `i` to open iOS simulator or `a` to open Android emulator.

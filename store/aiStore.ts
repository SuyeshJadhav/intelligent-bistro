import { create } from "zustand";

import type { CartAction } from "@/lib/types";

export interface Message {
  role: "user" | "ai";
  content: string;
  actions?: CartAction[];
}

interface AIState {
  isOpen: boolean;
  isProcessing: boolean;
  messages: Message[];
  executionLog: string[];
  lastError: string | null;
  openAI: () => void;
  closeAI: () => void;
  sendMessage: (content: string, actions?: CartAction[]) => void;
  addMessage: (message: Message) => void;
  setProcessing: (isProcessing: boolean) => void;
  appendLog: (entry: string) => void;
  clearLog: () => void;
  setLastError: (error: string | null) => void;
}

export const useAIStore = create<AIState>((set) => ({
  isOpen: false,
  isProcessing: false,
  messages: [],
  executionLog: [],
  lastError: null,
  openAI: () => set({ isOpen: true }),
  closeAI: () => set({ isOpen: false }),
  sendMessage: (content, actions) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          role: "user",
          content,
          ...(actions ? { actions } : {}),
        },
      ],
    })),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  setProcessing: (isProcessing) => set({ isProcessing }),
  appendLog: (entry) =>
    set((state) => ({
      executionLog: [...state.executionLog, entry],
    })),
  clearLog: () =>
    set({
      executionLog: [],
    }),
  setLastError: (error) => set({ lastError: error }),
}));

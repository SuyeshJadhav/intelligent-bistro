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
  // Clarification state
  clarificationRequired?: boolean;
  clarificationChoices?: {
    raw: string;
    resolvedId?: string | null;
    label?: string | null;
    confidence?: number | null;
    requestId?: string;
  }[];
  clarificationExpiresAt?: number | null;
  clarificationRequestId?: string | null;
  clarificationOriginalMessage?: string | null;
  clarificationAccepted?: { choice: any; requestId: string } | null;
  setClarification: (
    choices: any[],
    requestId: string,
    originalMessage?: string | null,
    expiresAt?: number | null,
  ) => void;
  clearClarificationState: () => void;
  acceptClarification: (choice: any) => void;
  setActiveRequestId: (id: string | null) => void;
  activeRequestId?: string | null;
}

export const useAIStore = create<AIState>((set, get) => {
  let clarificationTimeout: ReturnType<typeof setTimeout> | null = null;

  const api: AIState = {
    isOpen: false,
    isProcessing: false,
    messages: [],
    executionLog: [],
    lastError: null,
    clarificationRequired: false,
    clarificationChoices: undefined,
    clarificationExpiresAt: null,
    clarificationRequestId: null,
    clarificationOriginalMessage: null,
    clarificationAccepted: null,
    activeRequestId: null,
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
      set((state) => ({ messages: [...state.messages, message] })),
    setProcessing: (isProcessing) => set({ isProcessing }),
    appendLog: (entry) =>
      set((state) => ({ executionLog: [...state.executionLog, entry] })),
    clearLog: () => set({ executionLog: [] }),
    setLastError: (error) => set({ lastError: error }),
    setClarification: (
      choices,
      requestId,
      originalMessage = null,
      expiresAt = null,
    ) => {
      if (clarificationTimeout) {
        clearTimeout(clarificationTimeout as any);
        clarificationTimeout = null;
      }
      set((state) => ({
        clarificationRequired: true,
        clarificationChoices: choices.map((c: any) => ({ ...c, requestId })),
        clarificationExpiresAt: expiresAt,
        clarificationRequestId: requestId,
        clarificationOriginalMessage: originalMessage,
      }));

      if (expiresAt) {
        const ms = Math.max(0, expiresAt - Date.now());
        clarificationTimeout = setTimeout(() => {
          const state = get();
          if (
            state.clarificationRequestId === requestId &&
            state.clarificationExpiresAt &&
            Date.now() >= state.clarificationExpiresAt
          ) {
            set({
              clarificationRequired: false,
              clarificationChoices: undefined,
              clarificationExpiresAt: null,
              clarificationRequestId: null,
              clarificationOriginalMessage: null,
              clarificationAccepted: null,
              executionLog: [
                ...state.executionLog,
                new Date().toISOString() + " - CLARIFICATION_CONTEXT_EXPIRED",
              ],
            });
          }
          clarificationTimeout = null;
        }, ms);
      }
    },
    clearClarificationState: () =>
      set({
        clarificationRequired: false,
        clarificationChoices: undefined,
        clarificationExpiresAt: null,
        clarificationRequestId: null,
        clarificationOriginalMessage: null,
        clarificationAccepted: null,
      }),
    acceptClarification: (choice) =>
      set((state) => {
        if (
          !state.clarificationRequestId ||
          choice.requestId !== state.clarificationRequestId ||
          (state.activeRequestId &&
            state.activeRequestId !== state.clarificationRequestId)
        ) {
          const now = new Date().toISOString();
          return {
            clarificationRequired: false,
            clarificationChoices: undefined,
            clarificationExpiresAt: null,
            clarificationRequestId: null,
            clarificationOriginalMessage: null,
            clarificationAccepted: null,
            executionLog: [
              ...state.executionLog,
              `${now} - CONTEXT_INVALIDATED`,
            ],
          };
        }

        const now = new Date().toISOString();
        return {
          clarificationAccepted: {
            choice,
            requestId: state.clarificationRequestId!,
          },
          executionLog: [
            ...state.executionLog,
            `${now} - CLARIFICATION_ACCEPTED`,
          ],
        } as any;
      }),
    setActiveRequestId: (id) => set({ activeRequestId: id }),
  };

  return api;
});

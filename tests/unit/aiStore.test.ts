/**
 * aiStore.test.ts - Unit tests for the AI Zustand store
 *
 * Tests:
 * - All state transitions
 * - Message accumulation
 * - Execution log behavior
 * - Processing state management
 * - Open/close state
 */

import { useAIStore } from "@/store/aiStore";
import type { Message } from "@/store/aiStore";
import { beforeEach, describe, expect, it } from "vitest";
import { resetAIStore } from "../__helpers__/storeHelpers";
import { makeUserMessage, makeAIMessage, makeConversation } from "../__fixtures__/factories";

describe("aiStore", () => {
  beforeEach(() => {
    resetAIStore();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  describe("Initial state", () => {
    it("should start with correct default values", () => {
      const state = useAIStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.isProcessing).toBe(false);
      expect(state.messages).toEqual([]);
      expect(state.executionLog).toEqual([]);
    });
  });

  // ── openAI / closeAI ──────────────────────────────────────────────────────

  describe("openAI / closeAI", () => {
    it("should set isOpen to true when openAI is called", () => {
      useAIStore.getState().openAI();
      expect(useAIStore.getState().isOpen).toBe(true);
    });

    it("should set isOpen to false when closeAI is called", () => {
      useAIStore.getState().openAI();
      useAIStore.getState().closeAI();
      expect(useAIStore.getState().isOpen).toBe(false);
    });

    it("should be safe to call openAI multiple times", () => {
      useAIStore.getState().openAI();
      useAIStore.getState().openAI();
      expect(useAIStore.getState().isOpen).toBe(true);
    });

    it("should be safe to call closeAI when already closed", () => {
      expect(() => useAIStore.getState().closeAI()).not.toThrow();
      expect(useAIStore.getState().isOpen).toBe(false);
    });
  });

  // ── setProcessing ─────────────────────────────────────────────────────────

  describe("setProcessing", () => {
    it("should set isProcessing to true", () => {
      useAIStore.getState().setProcessing(true);
      expect(useAIStore.getState().isProcessing).toBe(true);
    });

    it("should set isProcessing back to false", () => {
      useAIStore.getState().setProcessing(true);
      useAIStore.getState().setProcessing(false);
      expect(useAIStore.getState().isProcessing).toBe(false);
    });
  });

  // ── sendMessage ───────────────────────────────────────────────────────────

  describe("sendMessage", () => {
    it("should add a user message to messages array", () => {
      useAIStore.getState().sendMessage("Add 2 burrata salads");

      const { messages } = useAIStore.getState();
      expect(messages).toHaveLength(1);
      expect(messages[0]?.role).toBe("user");
      expect(messages[0]?.content).toBe("Add 2 burrata salads");
    });

    it("should not include actions field when no actions provided", () => {
      useAIStore.getState().sendMessage("Hello");
      const message = useAIStore.getState().messages[0];
      expect(message?.actions).toBeUndefined();
    });

    it("should preserve message ordering across multiple sends", () => {
      useAIStore.getState().sendMessage("First");
      useAIStore.getState().sendMessage("Second");
      useAIStore.getState().sendMessage("Third");

      const { messages } = useAIStore.getState();
      expect(messages).toHaveLength(3);
      expect(messages[0]?.content).toBe("First");
      expect(messages[1]?.content).toBe("Second");
      expect(messages[2]?.content).toBe("Third");
    });
  });

  // ── addMessage ────────────────────────────────────────────────────────────

  describe("addMessage", () => {
    it("should add a user message", () => {
      const msg: Message = { role: "user", content: "Test message" };
      useAIStore.getState().addMessage(msg);

      expect(useAIStore.getState().messages).toHaveLength(1);
      expect(useAIStore.getState().messages[0]?.role).toBe("user");
    });

    it("should add an AI message", () => {
      const msg: Message = { role: "ai", content: "I've added that to your cart." };
      useAIStore.getState().addMessage(msg);

      expect(useAIStore.getState().messages[0]?.role).toBe("ai");
    });

    it("should maintain proper conversation ordering", () => {
      useAIStore.getState().addMessage({ role: "user", content: "Order 1" });
      useAIStore.getState().addMessage({ role: "ai", content: "Processed 1" });
      useAIStore.getState().addMessage({ role: "user", content: "Order 2" });

      const { messages } = useAIStore.getState();
      expect(messages[0]?.role).toBe("user");
      expect(messages[1]?.role).toBe("ai");
      expect(messages[2]?.role).toBe("user");
    });

    it("should handle a full 100-message conversation without issues", () => {
      const conversation = makeConversation(50); // 100 messages
      conversation.forEach((msg) =>
        useAIStore.getState().addMessage(msg as Message),
      );

      expect(useAIStore.getState().messages).toHaveLength(100);
    });
  });

  // ── appendLog / clearLog ──────────────────────────────────────────────────

  describe("appendLog", () => {
    it("should append entries to execution log in order", () => {
      useAIStore.getState().appendLog("PROCESSING_INTENT...");
      useAIStore.getState().appendLog("VALIDATING_MENU...");
      useAIStore.getState().appendLog("UPDATING_STATE...");
      useAIStore.getState().appendLog("SYNC_COMPLETE");

      const { executionLog } = useAIStore.getState();
      expect(executionLog).toHaveLength(4);
      expect(executionLog[0]).toBe("PROCESSING_INTENT...");
      expect(executionLog[3]).toBe("SYNC_COMPLETE");
    });

    it("should allow appending to existing log entries (cumulative)", () => {
      useAIStore.getState().appendLog("STEP_1");
      useAIStore.getState().appendLog("STEP_2");

      expect(useAIStore.getState().executionLog).toHaveLength(2);
    });
  });

  describe("clearLog", () => {
    it("should reset execution log to empty array", () => {
      useAIStore.getState().appendLog("STEP_1");
      useAIStore.getState().appendLog("STEP_2");
      useAIStore.getState().clearLog();

      expect(useAIStore.getState().executionLog).toEqual([]);
    });

    it("should be safe to clear an already empty log", () => {
      expect(() => useAIStore.getState().clearLog()).not.toThrow();
    });
  });

  // ── State isolation ────────────────────────────────────────────────────────

  describe("State isolation", () => {
    it("each beforeEach reset should produce a clean slate", () => {
      // If this test sees data from a previous test, isolation is broken
      const state = useAIStore.getState();
      expect(state.messages).toHaveLength(0);
      expect(state.executionLog).toHaveLength(0);
      expect(state.isOpen).toBe(false);
      expect(state.isProcessing).toBe(false);
    });
  });
});

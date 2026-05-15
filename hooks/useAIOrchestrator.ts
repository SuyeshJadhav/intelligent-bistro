import { toCartPayload } from "@/lib/api";
import { applyCartDeltaSafe } from "@/lib/applyCartDelta";
import { parseAIResponse } from "@/lib/defensiveParsing";
import { requestManager } from "@/lib/requestManager";
import { useAIStore } from "@/store/aiStore";
import { useCartStore } from "@/store/cartStore";
import { useCallback, useEffect } from "react";

export function useAIOrchestrator(
  input: string,
  setInput: (v: string) => void,
) {
  const isProcessing = useAIStore((state) => state.isProcessing);
  const setProcessing = useAIStore((state) => state.setProcessing);
  const appendLog = useAIStore((state) => state.appendLog);
  const clearLog = useAIStore((state) => state.clearLog);
  const cartItems = useCartStore((state) => state.items);

  const setLastError = useAIStore((state) => state.setLastError);
  const setClarification = useAIStore((s) => s.setClarification);
  const clearClarificationState = useAIStore((s) => s.clearClarificationState);
  const setActiveRequestId = useAIStore((s) => s.setActiveRequestId);
  const activeRequestId = useAIStore((s) => s.activeRequestId);

  const handleSend = useCallback(
    async (overridePrompt?: unknown, originatingRequestId?: string) => {
      const prompt = input.trim();

      const effectivePrompt =
        typeof overridePrompt === "string" ? overridePrompt.trim() : prompt;

      if (!effectivePrompt || isProcessing) {
        return;
      }

      try {
        // Clear previous errors and log
        setLastError(null);
        clearLog();
        // Invalidate any pending clarification when the user starts a new request
        useAIStore.getState().clearClarificationState();

        // 1. Show optimistic user message
        const userMessage = { role: "user" as const, content: effectivePrompt };
        useAIStore.setState((state) => ({
          messages: [...state.messages, userMessage],
        }));

        // Clear input immediately for better UX
        setInput("");

        // 2. Start processing
        setProcessing(true);
        // request-scoped id
        const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        setActiveRequestId(requestId);
        appendLog("PROCESSING_INTENT...");

        // 3. Send to backend API via RequestManager (handles retry, debounce)
        appendLog("VALIDATING_MENU...");

        const cartPayload = toCartPayload(cartItems);

        // Use RequestManager for production-grade reliability
        const response = await requestManager.sendWithRetry(
          effectivePrompt,
          cartPayload,
          (attempt, error) => {
            console.log(
              `[AIAssistant] Retry attempt ${attempt}: ${error.message}`,
            );
            appendLog(`RETRYING... (${attempt})`);
          },
        );

        // 4. Defensively parse response
        const parsedResponse = parseAIResponse(response);
        if (!parsedResponse) {
          throw new Error("Backend response failed validation");
        }

        // If backend returned clarification choices, surface them and stop execution
        if (
          (parsedResponse as any).clarificationChoices &&
          (parsedResponse as any).clarificationChoices.length > 0
        ) {
          const expiresAt = Date.now() + 30_000; // 30s TTL
          setClarification(
            (parsedResponse as any).clarificationChoices,
            requestId,
            effectivePrompt,
            expiresAt,
          );
          appendLog(new Date().toISOString() + " - CLARIFICATION_REQUIRED");

          // schedule TTL invalidation
          setTimeout(
            () => {
              const state = useAIStore.getState();
              if (
                state.clarificationRequestId === requestId &&
                state.clarificationExpiresAt &&
                Date.now() >= state.clarificationExpiresAt
              ) {
                state.clearClarificationState();
                state.appendLog(
                  new Date().toISOString() + " - CLARIFICATION_CONTEXT_EXPIRED",
                );
              }
            },
            Math.max(0, expiresAt - Date.now()),
          );

          // Let finally() clear processing state and keep logs as-is
          return;
        }

        // 5. Show execution logs from backend
        for (const logEntry of parsedResponse.executionLog) {
          appendLog(logEntry);
          // Small delay between log entries for staggered visual effect
          await new Promise((resolve) => setTimeout(resolve, 150));
        }

        const cartStoreMethods = {
          addItem: useCartStore.getState().addItem,
          removeItem: useCartStore.getState().removeItem,
          updateQuantity: useCartStore.getState().updateQuantity,
        };

        // 6. Apply cart mutations safely
        appendLog("APPLYING_MUTATIONS...");
        const { failed } = applyCartDeltaSafe(
          parsedResponse.actions,
          cartStoreMethods,
        );

        if (failed > 0) {
          console.warn(`[AIAssistant] ${failed} cart actions failed to apply`);
        }

        // 7. Show AI response message
        const aiMessage = {
          role: "ai" as const,
          content: parsedResponse.confirmation,
        };

        useAIStore.setState((state) => ({
          messages: [...state.messages, aiMessage],
        }));

        // Mark completion
        appendLog("COMPLETE");
      } catch (error) {
        let errorMessage = "Something went wrong. Please try again.";
        let logEntry = "ERROR";

        if (error instanceof Error) {
          if (
            error.message.includes("offline") ||
            error.message.includes("Offline")
          ) {
            errorMessage =
              "You appear to be offline. Please check your connection.";
            logEntry = "OFFLINE_ERROR";
          } else if (error.message.includes("Too many requests")) {
            errorMessage = "Please wait before sending another message.";
            logEntry = "DEBOUNCE_ERROR";
          } else if (error.message.includes("timed out")) {
            errorMessage =
              "Request timed out. Backend may be slow or unreachable.";
            logEntry = "TIMEOUT_ERROR";
          } else if (error.message.includes("validation")) {
            errorMessage =
              "Backend returned invalid data. Please check backend logs.";
            logEntry = "VALIDATION_ERROR";
          } else if (error.message !== "Network request failed") {
            errorMessage = error.message;
          }
        }

        setLastError(errorMessage);
        appendLog(logEntry);

        useAIStore.setState((state) => ({
          messages: [
            ...state.messages,
            {
              role: "ai",
              content: errorMessage,
              isError: true,
            },
          ],
        }));
      } finally {
        setProcessing(false);
        // clear active request id on finish
        setActiveRequestId(null);
      }
    },
    [
      input,
      setInput,
      isProcessing,
      cartItems,
      appendLog,
      clearLog,
      setProcessing,
    ],
  );

  // Subscribe to clarificationAccepted and auto-resume if it matches the activeRequestId
  useEffect(() => {
    const unsubscribe = useAIStore.subscribe((state, prevState) => {
      const accepted = state.clarificationAccepted;
      const previousAccepted = prevState?.clarificationAccepted;
      if (!accepted || accepted === previousAccepted) {
        return;
      }

      if (accepted.requestId !== state.activeRequestId) {
        return;
      }

      const original = state.clarificationOriginalMessage || input;
      const resolved = accepted.choice.resolvedId || accepted.choice.raw;

      try {
        const escaped = (accepted.choice.raw || "").replace(
          /[.*+?^${}()|[\\]\\]/g,
          "\\$&",
        );
        const regex = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "i");
        const newPrompt = regex.test(original)
          ? original.replace(regex, resolved)
          : `${original} ${resolved}`;

        state.clearClarificationState();
        void handleSend(newPrompt, state.activeRequestId || undefined);
      } catch (error) {
        console.error(
          "[Orchestrator] Failed to auto-resume after clarification:",
          error,
        );
      }
    });

    return unsubscribe;
  }, [handleSend, input]);

  return { handleSend };
}

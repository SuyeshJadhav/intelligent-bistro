import { useCallback } from "react";
import { applyCartDeltaSafe } from "@/lib/applyCartDelta";
import { parseAIResponse } from "@/lib/defensiveParsing";
import { requestManager } from "@/lib/requestManager";
import { toCartPayload } from "@/lib/api";
import { useAIStore } from "@/store/aiStore";
import { useCartStore } from "@/store/cartStore";

export function useAIOrchestrator(input: string, setInput: (v: string) => void) {
  const isProcessing = useAIStore((state) => state.isProcessing);
  const setProcessing = useAIStore((state) => state.setProcessing);
  const appendLog = useAIStore((state) => state.appendLog);
  const clearLog = useAIStore((state) => state.clearLog);
  const cartItems = useCartStore((state) => state.items);

  const setLastError = useAIStore((state) => state.setLastError);

  const handleSend = useCallback(async () => {
    const prompt = input.trim();

    if (!prompt || isProcessing) {
      return;
    }

    try {
      // Clear previous errors and log
      setLastError(null);
      clearLog();

      // 1. Show optimistic user message
      const userMessage = { role: "user" as const, content: prompt };
      useAIStore.setState((state) => ({
        messages: [...state.messages, userMessage],
      }));

      // Clear input immediately for better UX
      setInput("");

      // 2. Start processing
      setProcessing(true);
      appendLog("PROCESSING_INTENT...");

      // 3. Send to backend API via RequestManager (handles retry, debounce)
      appendLog("VALIDATING_MENU...");

      const cartPayload = toCartPayload(cartItems);

      // Use RequestManager for production-grade reliability
      const response = await requestManager.sendWithRetry(
        prompt,
        cartPayload,
        (attempt, error) => {
          console.log(`[AIAssistant] Retry attempt ${attempt}: ${error.message}`);
          appendLog(`RETRYING... (${attempt})`);
        }
      );

      // 4. Defensively parse response
      const parsedResponse = parseAIResponse(response);
      if (!parsedResponse) {
        throw new Error("Backend response failed validation");
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
      const { failed } = applyCartDeltaSafe(parsedResponse.actions, cartStoreMethods);

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
        if (error.message.includes("offline") || error.message.includes("Offline")) {
          errorMessage = "You appear to be offline. Please check your connection.";
          logEntry = "OFFLINE_ERROR";
        } else if (error.message.includes("Too many requests")) {
          errorMessage = "Please wait before sending another message.";
          logEntry = "DEBOUNCE_ERROR";
        } else if (error.message.includes("timed out")) {
          errorMessage = "Request timed out. Backend may be slow or unreachable.";
          logEntry = "TIMEOUT_ERROR";
        } else if (error.message.includes("validation")) {
          errorMessage = "Backend returned invalid data. Please check backend logs.";
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
    }
  }, [input, setInput, isProcessing, cartItems, appendLog, clearLog, setProcessing]);

  return { handleSend };
}

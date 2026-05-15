import { useAIStore } from "@/store/aiStore";
import { describe, expect, it } from "vitest";

describe("clarification stale handling", () => {
  it("ignores acceptance for stale clarification request", () => {
    const store = useAIStore.getState();
    // simulate a request A
    store.setActiveRequestId("A");
    store.setClarification(
      [{ raw: "pasta", resolvedId: "tagliatelle" }],
      "A",
      "add the pasta",
      Date.now() + 30000,
    );

    // simulate new request B starting
    store.setActiveRequestId("B");

    // user tries to accept the old clarification (request A) - should invalidate instead
    store.acceptClarification({
      raw: "pasta",
      resolvedId: "tagliatelle",
      requestId: "A",
    });

    const s = useAIStore.getState();
    expect(s.clarificationRequired).toBeFalsy();
    expect(s.clarificationAccepted).toBeNull();
    // last log should include CONTEXT_INVALIDATED
    expect(s.executionLog[s.executionLog.length - 1]).toContain(
      "CONTEXT_INVALIDATED",
    );
  });
});

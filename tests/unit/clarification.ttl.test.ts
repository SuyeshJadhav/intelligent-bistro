import { useAIStore } from "@/store/aiStore";
import { describe, expect, it } from "vitest";

describe("clarification TTL expiry", () => {
  it("expires clarification after TTL and logs expiry", async () => {
    const store = useAIStore.getState();
    const now = Date.now();
    const expiresAt = now + 120; // 120ms

    store.setClarification(
      [{ raw: "salad", resolvedId: "caesar" }],
      "T1",
      "add salad",
      expiresAt,
    );

    // wait for TTL to elapse
    await new Promise((r) => setTimeout(r, 180));

    const s = useAIStore.getState();
    expect(s.clarificationRequired).toBeFalsy();
    expect(s.clarificationRequestId).toBeNull();
    // last log entry should include CLARIFICATION_CONTEXT_EXPIRED
    expect(s.executionLog[s.executionLog.length - 1]).toContain(
      "CLARIFICATION_CONTEXT_EXPIRED",
    );
  });
});

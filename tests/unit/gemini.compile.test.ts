import { compilePlannerResponse } from "@/server/src/lib/gemini";
import { describe, expect, it } from "vitest";

describe("compilePlannerResponse", () => {
  it("compiles planner intent graph into cart actions and includes telemetry confidence", () => {
    const plannerResp = {
      intentGraph: [
        {
          intent: "ADD",
          targets: [
            {
              raw: "yuzu spiritz",
              resolvedId: "yuzu-spritz",
              label: "Yuzu Spritz",
              confidence: 0.65,
              quantity: 2,
              modifiers: [{ type: "spice_level", value: "extra_spicy" }],
            },
          ],
        },
      ],
      confirmation: "Added drinks",
    } as any;

    const resolverResult = {
      matches: [
        {
          raw: "yuzu spiritz",
          resolvedId: "yuzu-spritz",
          label: "Yuzu Spritz",
          score: 0.2,
          confidence: 0.65,
          spanStart: 2,
          spanEnd: 4,
        },
      ],
    } as any;

    const aiResp = compilePlannerResponse(plannerResp, resolverResult);
    expect(aiResp.actions.length).toBe(1);
    expect(aiResp.actions[0].type).toBe("ADD_ITEM");
    expect(aiResp.actions[0].itemId).toBe("yuzu-spritz");
    expect((aiResp.actions[0] as any).modifiers).toEqual([
      { type: "spice_level", value: "extra_spicy" },
    ]);
    expect(
      aiResp.executionLog.some((l) => l.includes("MATCH_CONFIDENCE")),
    ).toBe(true);
  });
});

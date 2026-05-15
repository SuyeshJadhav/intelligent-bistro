import { menuItems } from "@/server/src/data/menu";
import {
  resolveMenuMatches,
  resolveMenuMatchesWithScores,
} from "@/server/src/lib/fuzzyMatch";
import { describe, expect, it } from "vitest";

describe("fuzzy resolver", () => {
  it("resolves a misspelled drink to the correct id with high confidence", () => {
    const input = "add 2 yuzu spiritz";
    const res = resolveMenuMatchesWithScores(input, menuItems);
    expect(res.resolvedText).toContain("yuzu-spritz");
    const match = res.matches.find((m) => m.resolvedId === "yuzu-spritz");
    expect(match).toBeDefined();
    expect(match!.confidence).toBeGreaterThan(0.75);
  });

  it("backwards-compatible wrapper returns a string with the id replaced", () => {
    const input = "please add the yuzu spiritz to my order";
    const out = resolveMenuMatches(input, menuItems);
    expect(typeof out).toBe("string");
    expect(out).toContain("yuzu-spritz");
  });
});

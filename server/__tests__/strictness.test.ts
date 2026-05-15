import { describe, expect, it } from "vitest";
import { menuItems } from "../src/data/menu";
import { resolveMenuMatchesWithScores } from "../src/lib/fuzzyMatch";
import { filterMenuByDietary } from "../src/lib/gemini";

describe("Menu grounding and resolver strictness", () => {
  it('rejects generic out-of-domain item "cola"', () => {
    const res = resolveMenuMatchesWithScores("Add 1 cola", menuItems);
    expect(res.matches.length).toBe(0);
  });

  it('rejects "pizza" (not on menu)', () => {
    const res = resolveMenuMatchesWithScores("I want pizza", menuItems);
    expect(res.matches.length).toBe(0);
  });

  it('alias-only matching: "risotto" should match mushroom-risotto', () => {
    const res = resolveMenuMatchesWithScores(
      "Add risotto to my order",
      menuItems,
    );
    expect(res.matches.length).toBeGreaterThan(0);
    expect(res.matches[0].resolvedId).toBe("mushroom-risotto");
  });

  it('typo recovery: "yuzu spiritz" should fuzzy-match to yuzu-spritz', () => {
    const res = resolveMenuMatchesWithScores(
      "I want a yuzu spiritz please",
      menuItems,
    );
    expect(res.matches.length).toBeGreaterThan(0);
    expect(res.matches[0].resolvedId).toBe("yuzu-spritz");
    expect(res.matches[0].confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("vegan query returns empty when no vegan items exist", () => {
    const vegan = filterMenuByDietary(menuItems, "vegan");
    expect(vegan.length).toBe(0);
  });
});

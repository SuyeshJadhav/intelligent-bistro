import {
  formatAIMessageContent,
  formatExecutionLogEntry,
} from "@/lib/aiPresentation";
import { describe, expect, it } from "vitest";

describe("aiPresentation", () => {
  it("formats bullet-style AI responses into structured blocks", () => {
    const blocks = formatAIMessageContent(
      "Available drinks:\n• Yuzu Spritz — $11\n• Black Sesame Cold Brew — $9\n• Citrus Vermouth Soda — $12",
    );

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: "paragraph",
      text: "Available drinks:",
    });
    expect(blocks[1]).toMatchObject({
      type: "list",
      items: [
        { label: "Yuzu Spritz", price: "$11" },
        { label: "Black Sesame Cold Brew", price: "$9" },
        { label: "Citrus Vermouth Soda", price: "$12" },
      ],
    });
  });

  it("keeps plain prose as a paragraph block", () => {
    const blocks = formatAIMessageContent(
      "We have several refreshing drinks available right now.",
    );

    expect(blocks).toEqual([
      {
        type: "paragraph",
        text: "We have several refreshing drinks available right now.",
      },
    ]);
  });

  it("extracts known menu items from inline drink prose", () => {
    const blocks = formatAIMessageContent(
      "We offer a selection of refreshing drinks including the Yuzu Spritz, Black Sesame Cold Brew, and Citrus Vermouth Soda. Would you like to add any of these to your order?",
    );

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({
      type: "paragraph",
      text: "We offer a selection of refreshing drinks",
    });
    expect(blocks[1]).toMatchObject({
      type: "list",
      items: [
        { label: "Yuzu Spritz", price: "$11" },
        { label: "Black Sesame Cold Brew", price: "$9" },
        { label: "Citrus Vermouth Soda", price: "$12" },
      ],
    });
    expect(blocks[2]).toEqual({
      type: "paragraph",
      text: "Would you like to add any of these to your order?",
    });
  });

  it("maps raw execution logs to calmer presentation labels", () => {
    expect(formatExecutionLogEntry("PROCESSING_INTENT...")).toEqual({
      label: "Understanding your request…",
    });

    expect(
      formatExecutionLogEntry(
        "2026-05-14T10:00:00.000Z - MATCH_CONFIDENCE: 58%",
        {
          isDevelopment: false,
        },
      ),
    ).toEqual({ label: "Closest match found", isDevOnly: true });

    expect(
      formatExecutionLogEntry("MATCH_CONFIDENCE: 58%", { isDevelopment: true }),
    ).toEqual({
      label: "Match confidence 58%",
      detail: "MATCH_CONFIDENCE: 58%",
      isDevOnly: true,
    });

    expect(formatExecutionLogEntry("STATE_SYNCHRONIZED")).toEqual({
      label: "Order synchronized",
    });
  });
});

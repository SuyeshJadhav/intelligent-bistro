/**
 * chat.route.test.ts - Integration tests for POST /api/chat
 *
 * Tests:
 * - Valid request → 200 + AIResponse shape
 * - Invalid body → 400
 * - Missing fields → 400
 * - Gemini mock failure → fallback response (200 with empty actions)
 * - Schema validation via Zod
 * - Extreme payload handling
 */

import express from "express";
import request from "supertest";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { processOrder } from "../src/lib/gemini";
import chatRouter from "../src/routes/chat";

// ── Mock Gemini to prevent real API calls ──────────────────────────────────

vi.mock("../src/lib/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/gemini")>();
  return {
    ...actual,
    processOrder: vi.fn(),
  };
});

const mockProcessOrder = vi.mocked(processOrder);

// ── Test app setup ─────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", chatRouter);
  return app;
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const VALID_AI_RESPONSE = {
  actions: [{ type: "ADD_ITEM", itemId: "burrata-salad", quantity: 2 }],
  confirmation: "Added 2 burrata salads.",
  executionLog: [
    "PROCESSING_INTENT...",
    "VALIDATING_MENU...",
    "UPDATING_STATE...",
    "SYNC_COMPLETE",
  ],
};

const VALID_BODY = {
  message: "Add 2 burrata salads",
  cart: [],
};

const VALID_BODY_WITH_CART = {
  message: "Remove the burrata",
  cart: [
    {
      id: "burrata-salad",
      name: "Burrata & Orchard Tomatoes",
      price: 14,
      quantity: 2,
    },
  ],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/chat", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  // ── Success path ──────────────────────────────────────────────────────────

  describe("Success responses", () => {
    it("should return 200 with valid AIResponse for valid request", async () => {
      mockProcessOrder.mockResolvedValue(VALID_AI_RESPONSE as any);

      const res = await request(app)
        .post("/api/chat")
        .send(VALID_BODY)
        .expect(200);

      expect(res.body.actions).toHaveLength(1);
      expect(res.body.actions[0].type).toBe("ADD_ITEM");
      expect(res.body.actions[0].itemId).toBe("burrata-salad");
      expect(res.body.confirmation).toBe("Added 2 burrata salads.");
      expect(res.body.executionLog).toHaveLength(4);
    });

    it("should return 200 with cart context passed to processOrder", async () => {
      mockProcessOrder.mockResolvedValue({
        actions: [{ type: "REMOVE_ITEM", itemId: "burrata-salad" }],
        confirmation: "Removed burrata.",
        executionLog: [
          "PROCESSING_INTENT...",
          "VALIDATING_MENU...",
          "UPDATING_STATE...",
          "SYNC_COMPLETE",
        ],
      } as any);

      await request(app)
        .post("/api/chat")
        .send(VALID_BODY_WITH_CART)
        .expect(200);

      expect(mockProcessOrder).toHaveBeenCalledWith(
        "Remove the burrata",
        VALID_BODY_WITH_CART.cart,
        expect.any(Array), // menuItems
      );
    });

    it("should accept empty cart array", async () => {
      mockProcessOrder.mockResolvedValue({
        actions: [],
        confirmation: "Nothing in cart.",
        executionLog: [
          "PROCESSING_INTENT...",
          "VALIDATING_MENU...",
          "NO_MATCH_FOUND",
          "AWAITING_INPUT...",
        ],
      } as any);

      const res = await request(app)
        .post("/api/chat")
        .send({ message: "Hello", cart: [] })
        .expect(200);

      expect(res.body.actions).toEqual([]);
    });
  });

  // ── Validation errors ─────────────────────────────────────────────────────

  describe("Request validation (400 errors)", () => {
    it("should return 400 when body is missing entirely", async () => {
      await request(app).post("/api/chat").expect(400);
    });

    it("should return 400 when message is missing", async () => {
      await request(app)
        .post("/api/chat")
        .send({ cart: [] })
        .expect(400);
    });

    it("should return 400 when message is empty string", async () => {
      await request(app)
        .post("/api/chat")
        .send({ message: "", cart: [] })
        .expect(400);
    });

    it("should return 400 when cart is missing", async () => {
      await request(app)
        .post("/api/chat")
        .send({ message: "Hello" })
        .expect(400);
    });

    it("should return 400 when cart is not an array", async () => {
      await request(app)
        .post("/api/chat")
        .send({ message: "Hello", cart: "not-array" })
        .expect(400);
    });

    it("should return 400 when cart item is missing required fields", async () => {
      await request(app)
        .post("/api/chat")
        .send({
          message: "Hello",
          cart: [{ id: "burrata-salad" }], // missing name, price, quantity
        })
        .expect(400);
    });

    it("should return 400 when cart item has wrong quantity type", async () => {
      await request(app)
        .post("/api/chat")
        .send({
          message: "Hello",
          cart: [
            {
              id: "burrata-salad",
              name: "Burrata",
              price: 14,
              quantity: "two", // string not number
            },
          ],
        })
        .expect(400);
    });

    it("should return 400 when cart item has negative quantity", async () => {
      await request(app)
        .post("/api/chat")
        .send({
          message: "Hello",
          cart: [
            {
              id: "burrata-salad",
              name: "Burrata",
              price: 14,
              quantity: -1, // Zod: nonnegative()
            },
          ],
        })
        .expect(400);
    });

    it("should return 400 for non-JSON body", async () => {
      await request(app)
        .post("/api/chat")
        .set("Content-Type", "application/json")
        .send("this is not json")
        .expect(400);
    });

    it("should include error message in 400 response", async () => {
      const res = await request(app)
        .post("/api/chat")
        .send({ message: "", cart: [] })
        .expect(400);

      expect(res.body).toHaveProperty("error");
      expect(typeof res.body.error).toBe("string");
    });
  });

  // ── Gemini failure handling ───────────────────────────────────────────────

  describe("Gemini failure handling", () => {
    it("should return 500 when processOrder throws an unhandled error", async () => {
      mockProcessOrder.mockRejectedValue(new Error("Unexpected Gemini error"));

      const res = await request(app)
        .post("/api/chat")
        .send(VALID_BODY)
        .expect(500);

      expect(res.body).toHaveProperty("error");
    });

    it("should return 200 with fallback response when processOrder returns fallback", async () => {
      // processOrder's own try/catch returns a fallback AIResponse, never throws
      const fallback = {
        actions: [],
        confirmation:
          "I couldn't process that order just now. Please try again with item names from our menu.",
        executionLog: [
          "PROCESSING_INTENT...",
          "VALIDATING_MENU...",
          "NO_MATCH_FOUND",
          "AWAITING_INPUT...",
        ],
      };
      mockProcessOrder.mockResolvedValue(fallback as any);

      const res = await request(app)
        .post("/api/chat")
        .send(VALID_BODY)
        .expect(200);

      expect(res.body.actions).toEqual([]);
      expect(res.body.confirmation).toContain("couldn't process");
    });
  });

  // ── Payload edge cases ────────────────────────────────────────────────────

  describe("Payload edge cases", () => {
    it("should handle very long message strings", async () => {
      mockProcessOrder.mockResolvedValue({
        actions: [],
        confirmation: "ok",
        executionLog: [
          "PROCESSING_INTENT...",
          "VALIDATING_MENU...",
          "NO_MATCH_FOUND",
          "AWAITING_INPUT...",
        ],
      } as any);

      const longMessage = "Add " + "burrata salad ".repeat(100);
      await request(app)
        .post("/api/chat")
        .send({ message: longMessage, cart: [] })
        .expect(200);
    });

    it("should handle cart with many items", async () => {
      mockProcessOrder.mockResolvedValue({
        actions: [],
        confirmation: "ok",
        executionLog: [
          "PROCESSING_INTENT...",
          "VALIDATING_MENU...",
          "NO_MATCH_FOUND",
          "AWAITING_INPUT...",
        ],
      } as any);

      const largeCart = Array(50).fill({
        id: "burrata-salad",
        name: "Burrata",
        price: 14,
        quantity: 1,
      });

      await request(app)
        .post("/api/chat")
        .send({ message: "Remove burrata", cart: largeCart })
        .expect(200);
    });
  });

  // ── Content-Type enforcement ───────────────────────────────────────────────

  describe("Content-Type", () => {
    it("should accept application/json requests", async () => {
      mockProcessOrder.mockResolvedValue(VALID_AI_RESPONSE as any);
      await request(app)
        .post("/api/chat")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(VALID_BODY))
        .expect(200);
    });
  });
});

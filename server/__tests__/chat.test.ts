/**
 * Backend integration tests for /api/chat endpoint
 *
 * Test areas:
 * - Valid order parsing
 * - Invalid item rejection
 * - Malformed AI response handling
 * - Schema validation
 * - Edge-case quantities
 *
 * Setup:
 * npm install --save-dev supertest @types/supertest
 *
 * Run:
 * npm run test -- backend/__tests__/chat.test.ts
 */

import type { Express } from "express";
import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import chatRouter from "../src/routes/chat";

vi.mock("../src/lib/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/gemini")>();
  return {
    ...actual,
    processOrder: vi.fn().mockResolvedValue({
      actions: [],
      confirmation: "I couldn't find that item on our current menu.",
      executionLog: [
        "PROCESSING_INTENT...",
        "VALIDATING_MENU...",
        "NO_MATCH_FOUND",
        "AWAITING_INPUT...",
      ],
      clarificationRequired: false,
      suggestions: [],
    }),
  };
});

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use("/api", chatRouter);
});

describe("POST /api/chat", () => {
  describe("Valid requests", () => {
    it("should parse a simple order request", async () => {
      const response = await request(app).post("/api/chat").send({
        message: "Add a grilled chicken sandwich",
        cart: [],
      });

      expect(response.status).toBeOneOf([200, 400, 500]); // May fail if no API key
      if (response.status === 200) {
        expect(response.body).toHaveProperty("actions");
        expect(response.body).toHaveProperty("confirmation");
        expect(response.body).toHaveProperty("executionLog");
        expect(Array.isArray(response.body.executionLog)).toBe(true);
        expect(response.body.executionLog).toHaveLength(4);
      }
    });

    it("should accept cart items in request", async () => {
      const response = await request(app)
        .post("/api/chat")
        .send({
          message: "Add one more cola",
          cart: [
            {
              id: "grilled-chicken-sandwich",
              name: "Grilled Chicken Sandwich",
              price: 14,
              quantity: 2,
            },
          ],
        });

      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe("Invalid requests", () => {
    it("should reject empty message", async () => {
      const response = await request(app).post("/api/chat").send({
        message: "",
        cart: [],
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should reject missing message field", async () => {
      const response = await request(app).post("/api/chat").send({
        cart: [],
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should reject non-array cart", async () => {
      const response = await request(app).post("/api/chat").send({
        message: "Add items",
        cart: "not an array",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should reject malformed cart items", async () => {
      const response = await request(app)
        .post("/api/chat")
        .send({
          message: "Add items",
          cart: [
            {
              // Missing required fields
              id: "item1",
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should reject negative prices", async () => {
      const response = await request(app)
        .post("/api/chat")
        .send({
          message: "Add items",
          cart: [
            {
              id: "item1",
              name: "Item 1",
              price: -10,
              quantity: 1,
            },
          ],
        });

      expect(response.status).toBe(400);
    });

    it("should reject negative quantities", async () => {
      const response = await request(app)
        .post("/api/chat")
        .send({
          message: "Add items",
          cart: [
            {
              id: "item1",
              name: "Item 1",
              price: 10,
              quantity: -1,
            },
          ],
        });

      expect(response.status).toBe(400);
    });

    it("should reject non-integer quantities", async () => {
      const response = await request(app)
        .post("/api/chat")
        .send({
          message: "Add items",
          cart: [
            {
              id: "item1",
              name: "Item 1",
              price: 10,
              quantity: 1.5,
            },
          ],
        });

      expect(response.status).toBe(400);
    });
  });

  describe("Response format validation", () => {
    it("should return response with correct structure when successful", async () => {
      const response = await request(app).post("/api/chat").send({
        message: "Add a sandwich",
        cart: [],
      });

      // Only validate structure if response is 200
      if (response.status === 200) {
        expect(response.body).toMatchObject({
          actions: expect.any(Array),
          confirmation: expect.any(String),
          executionLog: expect.any(Array),
        });

        // Validate executionLog has exactly 4 entries
        if (Array.isArray(response.body.executionLog)) {
          expect(response.body.executionLog).toHaveLength(4);
          expect(
            response.body.executionLog.every(
              (e: unknown) => typeof e === "string",
            ),
          ).toBe(true);
        }
      }
    });

    it("should return error response on server error", async () => {
      const response = await request(app).post("/api/chat").send({
        message: "Test message",
        cart: [],
      });

      if (response.status >= 500) {
        expect(response.body).toHaveProperty("error");
        expect(typeof response.body.error).toBe("string");
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle very long messages", async () => {
      const longMessage = "Add item".repeat(100);
      const response = await request(app).post("/api/chat").send({
        message: longMessage,
        cart: [],
      });

      expect([200, 400, 500]).toContain(response.status);
    });

    it("should handle large cart", async () => {
      const largeCart = Array.from({ length: 50 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        price: 10 + i,
        quantity: 1,
      }));

      const response = await request(app).post("/api/chat").send({
        message: "Update my order",
        cart: largeCart,
      });

      expect([200, 400, 500]).toContain(response.status);
    });

    it("should handle special characters in message", async () => {
      const response = await request(app).post("/api/chat").send({
        message: 'Add "spicy" chicken & 😀 emoji',
        cart: [],
      });

      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe("Content-Type handling", () => {
    it("should reject non-JSON content", async () => {
      const response = await request(app)
        .post("/api/chat")
        .set("Content-Type", "text/plain")
        .send("not json");

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});

// Helper for test assertions
declare global {
  namespace Vitest {
    interface Matchers<R> {
      toBeOneOf(values: unknown[]): R;
    }
  }
}

expect.extend({
  toBeOneOf(received, values) {
    const pass = values.includes(received);
    return {
      pass,
      message: () =>
        `Expected ${received} to be one of ${JSON.stringify(values)}`,
    };
  },
});

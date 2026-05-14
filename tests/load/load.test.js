/* eslint-disable */
/**
 * k6 Load Test — POST /api/chat
 *
 * Simulates realistic production traffic against the Intelligent Bistro backend.
 *
 * Scenarios:
 * 1. Baseline: 10 VUs for 30s (steady state)
 * 2. Ramp up: 0 → 50 VUs over 1 min (growth simulation)
 * 3. Stress: 100 VUs for 30s (peak traffic)
 * 4. Spike: 200 VUs for 10s (sudden burst)
 *
 * Thresholds (SLOs):
 * - p95 response time < 2000ms
 * - p99 response time < 5000ms
 * - Error rate < 1%
 * - 95%+ of requests return valid AIResponse shape
 *
 * Run with:
 *   k6 run __tests__/load/load.test.js
 *   k6 run --env API_URL=http://staging.example.com __tests__/load/load.test.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ── Custom metrics ────────────────────────────────────────────────────────

const validResponseRate = new Rate("valid_ai_response_rate");
const cartActionCount = new Counter("total_cart_actions");
const responseParseErrors = new Counter("response_parse_errors");
const p95ResponseTime = new Trend("p95_response_time", true);

// ── Configuration ─────────────────────────────────────────────────────────

const BASE_URL = __ENV.API_URL || "http://localhost:3000";

export const options = {
  scenarios: {
    // Scenario 1: Baseline steady-state
    baseline: {
      executor: "constant-vus",
      vus: 10,
      duration: "30s",
      tags: { scenario: "baseline" },
    },

    // Scenario 2: Gradual ramp-up
    ramp_up: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "30s", target: 50 },
        { duration: "30s", target: 50 },
        { duration: "30s", target: 0 },
      ],
      startTime: "35s",
      tags: { scenario: "ramp_up" },
    },

    // Scenario 3: Stress test
    stress: {
      executor: "constant-vus",
      vus: 100,
      duration: "30s",
      startTime: "3m",
      tags: { scenario: "stress" },
    },

    // Scenario 4: Spike test (sudden burst)
    spike: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 200,
      maxVUs: 300,
      stages: [
        { duration: "10s", target: 200 }, // spike
        { duration: "10s", target: 10 }, // recovery
      ],
      startTime: "4m",
      tags: { scenario: "spike" },
    },
  },

  thresholds: {
    // Latency SLOs
    http_req_duration: [
      "p(95)<2000", // 95th percentile under 2s
      "p(99)<5000", // 99th percentile under 5s
    ],
    // Error rate
    http_req_failed: ["rate<0.01"], // <1% error rate
    // Business SLO: valid AI responses
    valid_ai_response_rate: ["rate>0.95"], // 95%+ valid
  },
};

// ── Test payloads ─────────────────────────────────────────────────────────

const ORDERS = [
  { message: "Add 2 burrata salads", cart: [] },
  {
    message: "Add a tagliatelle and a yuzu spritz",
    cart: [],
  },
  {
    message: "Remove the salmon bowl",
    cart: [
      { id: "salmon-bowl", name: "Miso Salmon Bowl", price: 28, quantity: 1 },
    ],
  },
  {
    message: "Update the steak frites to 2",
    cart: [
      { id: "steak-frites", name: "Charred Steak Frites", price: 34, quantity: 1 },
    ],
  },
  { message: "Add a cold brew", cart: [] },
  { message: "What do you have for starters?", cart: [] },
  {
    message: "Clear my cart",
    cart: [
      { id: "burrata-salad", name: "Burrata & Orchard Tomatoes", price: 14, quantity: 2 },
      { id: "tagliatelle", name: "Black Pepper Tagliatelle", price: 24, quantity: 1 },
    ],
  },
];

function randomOrder() {
  return ORDERS[Math.floor(Math.random() * ORDERS.length)];
}

// ── Main test function ────────────────────────────────────────────────────

export default function () {
  const order = randomOrder();

  group("POST /api/chat", () => {
    const payload = JSON.stringify(order);
    const params = {
      headers: { "Content-Type": "application/json" },
      timeout: "30s",
    };

    const res = http.post(`${BASE_URL}/api/chat`, payload, params);

    // Record response time
    p95ResponseTime.add(res.timings.duration);

    // Validate response
    const isSuccess = check(res, {
      "status is 200": (r) => r.status === 200,
      "response is JSON": (r) => r.headers["Content-Type"]?.includes("application/json"),
      "has actions field": (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.actions);
        } catch {
          responseParseErrors.add(1);
          return false;
        }
      },
      "has confirmation field": (r) => {
        try {
          const body = JSON.parse(r.body);
          return typeof body.confirmation === "string";
        } catch {
          return false;
        }
      },
      "executionLog has 4 entries": (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.executionLog) && body.executionLog.length === 4;
        } catch {
          return false;
        }
      },
    });

    validResponseRate.add(isSuccess);

    // Count cart actions for business metrics
    try {
      const body = JSON.parse(res.body);
      if (Array.isArray(body.actions)) {
        cartActionCount.add(body.actions.length);
      }
    } catch {
      // Ignore parse errors (already counted above)
    }
  });

  // Think time between requests (simulates real user behavior)
  sleep(Math.random() * 2 + 0.5); // 0.5–2.5s
}

// ── Health check (runs once at start) ────────────────────────────────────

export function setup() {
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    console.error(`[k6] Health check failed: ${res.status}. Backend may not be running.`);
  } else {
    console.log(`[k6] Backend healthy. Starting load test against ${BASE_URL}`);
  }
}

export function teardown(data) {
  console.log("[k6] Load test complete.");
}

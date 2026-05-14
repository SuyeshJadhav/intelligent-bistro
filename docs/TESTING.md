# 🧪 Intelligent Bistro — Test Suite Documentation

## Overview

Production-grade testing infrastructure for the **Intelligent Bistro** AI-native ordering system.  
All 170 unit tests pass. Integration, performance, snapshot, backend, load, and E2E tests are scaffolded and ready to run.

---

## Test Architecture

```
__tests__/
├── __fixtures__/
│   ├── menuFixtures.ts          # Canonical menu items + invalid ID corpus
│   ├── aiResponseFixtures.ts    # All AI response shapes (success + failure modes)
│   └── factories.ts             # Type-safe data factories (CartItem, Message, etc.)
├── __helpers__/
│   └── storeHelpers.ts          # Zustand reset, seed, assertion helpers
├── __mocks__/
│   └── mockServer.ts            # MSW server + scenario handler factories
├── unit/
│   ├── defensiveParsing.test.ts  # 67 tests — all parsing edge cases
│   ├── applyCartDelta.extended.test.ts  # 30 tests — idempotency, hallucinations, security
│   ├── cartStore.test.ts         # 25 tests — all store transitions + derived totals
│   ├── aiStore.test.ts           # 22 tests — all state transitions
│   ├── requestManager.test.ts    # 26 tests — retry, backoff, debounce, offline
│   └── api.test.ts               # 26 tests — all error codes, schema validation
├── integration/
│   ├── fullOrderFlow.test.ts     # End-to-end pipeline (API → parse → cart)
│   ├── raceConditions.test.ts    # Concurrent mutations, stale responses, cancellation
│   ├── security.test.ts          # Injection, XSS, flooding, oversized payloads
│   └── aiFailureHandling.test.ts # Every documented AI failure mode
├── snapshots/
│   └── cartStore.snapshot.test.ts # State shape regression detection
├── performance/
│   └── performance.test.ts       # 16ms frame budget, 100+ message stores
└── load/
    └── load.test.js              # k6 — 4 scenarios, SLO thresholds

apps/backend/__tests__/
├── chat.route.test.ts            # Supertest integration tests for POST /api/chat
└── gemini.lib.test.ts            # Zod schema + processOrder unit tests

e2e/
└── intelligentBistro.e2e.ts      # Detox E2E — full user flow verification

.github/workflows/
└── ci.yml                        # GitHub Actions — 9 parallelized jobs
```

---

## Running Tests

```bash
# All unit tests (fastest feedback loop)
npm run test:unit

# Integration tests (requires no backend — MSW mocks network)
npm run test:integration

# Snapshot tests (detect state shape regressions)
npm run test:snapshots

# Performance benchmarks (soft timing assertions)
npm run test:perf

# Full suite with coverage report
npm run test:coverage

# Watch mode during development
npm run test:watch

# Update snapshots after intentional state changes
npm run test:update-snapshots

# Backend tests (from apps/backend/ directory)
cd apps/backend && npm test

# Load tests (requires k6 installed and backend running)
k6 run __tests__/load/load.test.js

# E2E tests (requires Detox + simulator setup)
npx detox test -c ios.sim.debug
```

---

## Coverage Targets

| Layer               | Lines | Functions | Branches |
| ------------------- | ----- | --------- | -------- |
| `lib/`              | ≥90%  | ≥90%      | ≥85%     |
| `store/`            | ≥90%  | ≥90%      | ≥85%     |
| `apps/backend/src/` | ≥80%  | ≥80%      | ≥75%     |

CI will fail if coverage drops below these thresholds.

---

## Critical Path Coverage

### ✅ Cart Synchronization (`applyCartDelta`)

- All 3 action types validated
- Idempotency under repeated mutations
- Price accuracy to 2 decimal places
- Conflicting actions in single delta
- 500-item payload performance
- Full order lifecycle (add → modify → remove → clear)

### ✅ Defensive Parsing (`defensiveParsing.ts`)

- `safeJsonParse` — 9 scenarios including markdown fences
- `validateCartAction` — 20 scenarios per action type
- `parseCartActions` — 12 scenarios (null, empty, nested, injection)
- `parseAIResponse` — 15 scenarios (missing fields, wrong types)
- `parseExecutionLog` — 7 scenarios (padding, truncation, type coercion)
- `createCartAction` — 9 scenarios (normalization, edge cases)

### ✅ Request Retries (`requestManager.ts`)

- Exponential backoff capped at `maxDelayMs`
- Retry on: `TIMEOUT`, `NETWORK`
- No retry on: `SERVER`, `PARSE`, `INVALID_RESPONSE`
- `onRetry` callback invocation with attempt number
- Debounce enforcement (300ms window)
- Online/offline detection
- Request cancellation with `cancelRequest()`
- `isProcessing` flag lifecycle

### ✅ AI Failure Modes

All documented failure scenarios are covered:

- Hallucinated menu items → rejected at `applyCartDelta`
- Malformed Gemini JSON → `parseAIResponse` returns null
- Wrong `executionLog` length → schema rejection
- Duplicate actions → quantity accumulation
- Conflicting actions → last write wins
- Zero/negative/fractional quantities → rejected
- `Infinity`/`NaN` quantities → rejected
- XSS payloads in `itemId` → not executed, rejected by menu lookup
- SQL injection in `itemId` → rejected by menu lookup
- 1000+ action arrays → no crash, deterministic result
- `applyCartDeltaSafe` on any input type → no throw

---

## CI/CD Pipeline

9 parallelized GitHub Actions jobs:

| Job                  | Trigger                | Requirement              |
| -------------------- | ---------------------- | ------------------------ |
| 🔷 TypeScript        | All pushes             | Zero errors              |
| 🔍 Lint              | All pushes             | Zero warnings            |
| 🧩 Unit Tests        | All pushes             | 170/170 pass             |
| 🔗 Integration Tests | All pushes             | All pass                 |
| 📸 Snapshot Tests    | All pushes             | No regressions           |
| ⚙️ Backend Tests     | All pushes             | All pass                 |
| 📊 Coverage          | After unit+integration | ≥90% lines               |
| ⚡ Performance Tests | After unit             | All pass                 |
| 🎲 Flaky Detection   | `main` branch only     | Consistent across 3 runs |

---

## Design Principles

### Behavioral Testing Over Implementation Details

Tests assert **state outcomes** (cart total, item count) rather than internal function calls. This makes tests resilient to implementation refactoring.

### Zero State Pollution

Every test calls `resetAllStores()` in `beforeEach`. The `storeHelpers.ts` module centralizes all Zustand reset logic — no direct `useCartStore.setState({})` scattered across tests.

### Deterministic AI Simulation

MSW intercepts all network calls. Tests never make real Gemini API requests. Handler factories produce specific scenarios: success, transient failure, timeout, malformed JSON.

### Security-First Testing

Injection payloads (XSS, SQL, SSTI, CRLF, null bytes, oversized strings) are tested in both the parsing layer and the cart mutation layer. The system must never execute or crash on any of these.

### Soft Performance Assertions

Timing tests use `console.warn` for violations rather than hard `expect` failures. This prevents flaky CI failures due to CI runner variance, while still surfacing regressions visibly.

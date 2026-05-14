# The Intelligent Bistro - Complete Implementation Guide

## Architecture Overview

This document outlines the production-grade AI-native restaurant ordering system built with a deterministic state management architecture.

### Philosophy

**Natural language as a command layer over deterministic state.**

- Users speak naturally ("Add two spicy chicken sandwiches")
- Gemini API parses intent into validated actions
- Actions are applied deterministically to Zustand cart state
- UI reflects state changes instantly
- No AI-driven mutations to state; all actions are validated first

## Project Structure

```
intelligent-bistro/
├── apps/
│   ├── frontend/
│   │   ├── app/                  # Expo Router screens
│   │   ├── components/
│   │   │   ├── ai/
│   │   │   │   ├── AIAssistantSheet.tsx # Main AI overlay (production-grade)
│   │   │   │   ├── AIMessage.tsx        # Message bubble component
│   │   │   │   ├── AIInput.tsx          # Text input component
│   │   │   │   ├── ExecutionLog.tsx     # System feedback rendering
│   │   │   │   └── ActionCard.tsx       # Action visualization
│   │   │   ├── menu/
│   │   │   │   ├── CategoryPills.tsx
│   │   │   │   ├── MenuCard.tsx
│   │   │   │   ├── MiniCartBar.tsx
│   │   │   │   └── SearchBar.tsx
│   │   │   └── cart/
│   │   │       ├── CartSheet.tsx
│   │   │       ├── CartProvider.tsx
│   │   │       └── CartItem.tsx
│   │   ├── lib/
│   │   │   ├── api.ts                   # Typed API client
│   │   │   ├── types.ts                # Shared types
│   │   │   ├── applyCartDelta.ts       # Cart synchronization engine
│   │   │   ├── requestManager.ts       # Retry, debounce, cancellation
│   │   │   └── defensiveParsing.ts     # Safe parsing utilities
│   │   ├── store/
│   │   │   ├── cartStore.ts             # Zustand cart state
│   │   │   └── aiStore.ts               # AI conversation state
│   │   ├── constants/
│   │   │   ├── menuData.ts              # Frontend menu
│   │   │   └── theme.ts                 # Design tokens
│   │   └── assets/
│   └── backend/
│       ├── src/
│       │   ├── index.ts                 # Express server
│       │   ├── data/
│       │   │   └── menu.ts              # Backend menu (mirrors frontend)
│       │   ├── lib/
│       │   │   └── gemini.ts            # Gemini API wrapper
│       │   └── routes/
│       │       └── chat.ts              # POST /api/chat endpoint
│       └── __tests__/
│           └── chat.test.ts             # Integration tests
├── shared/
│   ├── types/
│   └── menu/
└── docs/
```

## State Management

### Zustand Stores

#### CartStore (`store/cartStore.ts`)

Single source of truth for shopping cart.

```typescript
// Add item
useCartStore.getState().addItem({
  id: "grilled-chicken-sandwich",
  name: "Grilled Chicken Sandwich",
  price: 14,
  quantity: 2,
  description: "...",
  imageUrl: "...",
});

// Remove item
useCartStore.getState().removeItem("grilled-chicken-sandwich");

// Update quantity (0 removes the item)
useCartStore.getState().updateQuantity("grilled-chicken-sandwich", 3);

// Clear entire cart
useCartStore.getState().clearCart();
```

#### AIStore (`store/aiStore.ts`)

Manages conversation state and execution feedback.

```typescript
// Get state
const isOpen = useAIStore((state) => state.isOpen);
const messages = useAIStore((state) => state.messages);
const executionLog = useAIStore((state) => state.executionLog);

// Open/close assistant
useAIStore.getState().openAI();
useAIStore.getState().closeAI();

// Add message
useAIStore.setState((state) => ({
  messages: [...state.messages, { role: "user", content: "..." }],
}));

// Append execution log
useAIStore.getState().appendLog("PROCESSING_INTENT...");
```

## API Integration

### Phase 1: Typed API Client (`lib/api.ts`)

Provides strongly-typed communication with the backend.

```typescript
import { sendChatMessage } from "@/lib/api";

const cartState = [{ id: "item1", name: "Item 1", price: 10, quantity: 1 }];

try {
  const response = await sendChatMessage(
    "Add two spicy chickens",
    cartState,
    15000, // timeout in ms
  );

  // response is strongly typed AIResponse
  console.log(response.actions); // CartAction[]
  console.log(response.confirmation); // string
  console.log(response.executionLog); // [string, string, string, string]
} catch (error) {
  if (error instanceof APIClientError) {
    console.error(error.code); // "TIMEOUT" | "NETWORK" | "PARSE" | etc
  }
}
```

### Phase 2: AI Overlay System (`apps/frontend/components/ai/`)

Production-grade UI with premium minimal design.

**Components:**

- **AIAssistantSheet**: Main floating overlay with blur backdrop
- **AIMessage**: User/AI message bubbles with loading states
- **AIInput**: Text input with send button
- **ExecutionLog**: System feedback with staggered animations

**Design System:**

- Monochrome palette (warm #F6F6F3 background)
- Inter for UI, JetBrains Mono for system feedback
- AI accent color (#D9FF3F) for key affordances
- Smooth Reanimated animations
- Apple system panel aesthetic

### Phase 3: Cart Delta Engine (`lib/applyCartDelta.ts`)

Deterministic synchronization of AI actions to cart state.

```typescript
import { applyCartDelta, applyCartDeltaSafe } from "@/lib/applyCartDelta";

const actions = [
  { type: "ADD_ITEM", itemId: "grilled-chicken-sandwich", quantity: 2 },
  { type: "ADD_ITEM", itemId: "caesar-salad", quantity: 1 },
  { type: "UPDATE_QUANTITY", itemId: "grilled-chicken-sandwich", quantity: 3 },
];

const result = applyCartDelta(actions);
// { applied: 3, failed: 0, skipped: 0 }

// Safe version never throws
const safeResult = applyCartDeltaSafe(potentiallyMalformedData);
```

**Features:**

- Exhaustive switch on action types
- Menu item validation (can't add non-existent items)
- Quantity bounds checking
- Edge-case protection
- Detailed logging

### Phase 4: Optimistic UI

Implemented in `AIAssistantSheet.tsx`:

1. **Immediate user message display** - Message appears instantly
2. **Processing indicator** - Loading dots while backend processes
3. **Execution log animation** - Staggered display of system feedback
4. **Cart sync** - Actions applied after validation
5. **Error rollback** - Failed requests show error message, cart unchanged

### Phase 5: Integration Testing

#### Frontend Tests (`__tests__/lib/applyCartDelta.test.ts`)

Comprehensive test suite for cart synchronization:

```bash
npm run test -- __tests__/lib/applyCartDelta.test.ts
```

Tests cover:

- ADD_ITEM action validation
- REMOVE_ITEM handling
- UPDATE_QUANTITY edge cases
- Menu item validation
- Malformed data handling
- Price calculation accuracy

#### API Tests (`__tests__/api/sendChatMessage.test.ts`)

Tests for the API client:

```bash
npm run test -- __tests__/api/sendChatMessage.test.ts
```

Tests cover:

- Successful request/response
- Timeout handling
- Network error handling
- Response validation
- Malformed response rejection

#### Backend Tests (`apps/backend/__tests__/chat.test.ts`)

Integration tests for `/api/chat` endpoint:

```bash
cd apps/backend
npm run test -- __tests__/chat.test.ts
```

Tests cover:

- Valid order parsing
- Invalid item rejection
- Schema validation
- Edge-case quantities
- Special characters handling

### Phase 6: Production Hardening

#### Request Manager (`lib/requestManager.ts`)

Provides production-grade reliability:

```typescript
import { requestManager } from "@/lib/requestManager";

// Automatic retry with exponential backoff
const response = await requestManager.sendWithRetry(
  message,
  cartState,
  (attempt, error) => {
    console.log(`Retry ${attempt}: ${error.message}`);
  },
);

// Configure behavior
requestManager.setDebounceDelay(500); // Min time between requests
requestManager.setRetryConfig({
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
});

// Cancel in-flight request
requestManager.cancelRequest();

// Check status
if (requestManager.isProcessing()) {
  // A request is in progress
}
```

**Features:**

- Debouncing (min 300ms between requests)
- Automatic retry on transient errors
- Exponential backoff with jitter
- Request cancellation
- Offline detection
- Request queuing

#### Defensive Parsing (`lib/defensiveParsing.ts`)

Safe parsing utilities that never crash:

```typescript
import {
  parseAIResponse,
  parseCartActions,
  validateCartAction,
  parseExecutionLog,
} from "@/lib/defensiveParsing";

// Safe AI response parsing
const response = parseAIResponse(unknownData);
if (response === null) {
  console.error("Invalid response from backend");
} else {
  // response is guaranteed to be valid AIResponse
}

// Safe cart actions parsing
const actions = parseCartActions(unknownData);
// Returns CartAction[] (empty array if malformed)

// Safe action validation
const action = validateCartAction(unknownData);
if (action === null) {
  console.error("Invalid action");
} else {
  // action is guaranteed to be valid CartAction
}

// Safe execution log parsing (always returns 4 entries)
const log = parseExecutionLog(unknownData);
// [string, string, string, string]
```

## Configuration

### Frontend Environment (`.env.local`)

```
# Backend API URL
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### Backend Environment (`apps/backend/.env`)

```
# Gemini API configuration
GEMINI_API_KEY=your_api_key_here

# Server port
PORT=3000
```

## Running the System

### Development Setup

1. **Start backend:**

   ```bash
   cd apps/backend
   npm install
   npm run dev
   ```

2. **Start frontend (in another terminal):**

   ```bash
   npm install
   npm start
   ```

3. **Test locally:**

   ```bash
   # Run frontend tests
   npm run test -- --watch

   # Run backend tests
   cd apps/backend && npm run test -- --watch
   ```

### Production Build

```bash
# Frontend
npm run build  # Generates Expo build

# Backend
cd apps/backend
npm run build
npm start
```

## Usage Flow

### 1. User Opens AI Assistant

```
User taps AI button (✦) on menu screen
↓
AIAssistantSheet opens with blur backdrop
↓
Displays welcome message with command examples
```

### 2. User Sends Message

```
User types: "Add two spicy chicken sandwiches and a cola"
User taps Send
↓
Message appears immediately (optimistic UI)
↓
AIAssistantSheet calls requestManager.sendWithRetry()
↓
PROCESSING_INTENT... animation starts
```

### 3. Backend Processing

```
POST /api/chat request arrives at backend
↓
Zod validates request schema
↓
Gemini API processes intent + menu + cart context
↓
Response validated against strict AIResponse schema
↓
Returns JSON with actions + confirmation + executionLog
```

### 4. Frontend Applies Delta

```
AIAssistantSheet receives response
↓
Defensive parsing validates structure
↓
Execution log entries animate on screen:
  PROCESSING_INTENT...
  VALIDATING_MENU...
  UPDATING_STATE...
  SYNC_COMPLETE
↓
applyCartDelta applies validated actions to Zustand
↓
Cart totals update (number reactivity)
↓
AI confirmation message displays
```

### 5. Error Handling

```
If request fails:
↓
RequestManager automatically retries (up to 3x with backoff)
↓
If all retries exhausted:
  ├─ TIMEOUT_ERROR → "Request timed out"
  ├─ NETWORK_ERROR → "Please check your connection"
  ├─ VALIDATION_ERROR → "Backend returned invalid data"
  └─ Fallback → "Something went wrong. Please try again."
↓
Error message appears in chat
↓
Cart state unchanged (no partial application)
```

## Design Decisions

### Why Zustand Over Redux/Context?

- **Minimal boilerplate** - Simple action-based updates
- **Performance** - Granular subscriptions, no re-render cascades
- **Type safety** - Excellent TypeScript support
- **Simplicity** - Perfect for cart state; no middleware complexity

### Why AI Response Validation?

- **Llama hallucinations** - LLM can return invalid item IDs
- **Schema drift** - Unexpected field changes
- **Graceful degradation** - Invalid actions skipped, not applied
- **Production stability** - Never crash on AI output

### Why RequestManager?

- **Network reliability** - Automatic retry on transient failures
- **User experience** - Debounce prevents accidental double-sends
- **Mobile reality** - Network drops happen; apps should recover
- **Exhaustive testing** - Request lifecycle fully controlled

### Why Defensive Parsing?

- **Depth of safety** - Multiple validation layers
- **Debugging** - Detailed logging of parse failures
- **Production confidence** - App never crashes from malformed data
- **Future-proofing** - If Gemini SDK changes, we're protected

## Error Codes Reference

### APIClientError Codes

- **TIMEOUT** - Request exceeded timeout duration
- **NETWORK** - Network connectivity error (fetch failed)
- **PARSE** - Response JSON parsing failure
- **INVALID_RESPONSE** - Response doesn't match AIResponse schema
- **SERVER** - HTTP 4xx/5xx error from backend

### Execution Log Entries

- **PROCESSING_INTENT** - Analyzing user message
- **VALIDATING_MENU** - Cross-referencing items with menu
- **UPDATING_STATE** - Applying cart mutations
- **SYNC_COMPLETE** - Synchronization finished
- **RETRYING** - Automatic retry in progress
- **OFFLINE_ERROR** - No network connectivity
- **DEBOUNCE_ERROR** - Too many requests too quickly
- **TIMEOUT_ERROR** - Request timed out
- **VALIDATION_ERROR** - Response validation failed
- **NETWORK_ERROR** - Network error occurred

## Performance Optimization

### Frontend

- **Bottom sheet snapping** - Optimized snap points with dynamic sizing disabled
- **Reanimated worklets** - Smooth 60fps animations
- **ScrollView optimization** - `nestedScrollEnabled` prevents gesture conflicts
- **Zustand selectors** - Components only subscribe to needed state slices

### Backend

- **Streaming parsing** - Gemini responses parsed as they arrive
- **Connection pooling** - Express handles concurrent requests efficiently
- **Middleware ordering** - CORS → JSON parsing → routes
- **Error boundaries** - No unhandled rejections

### Network

- **Request debouncing** - Min 300ms between requests
- **Timeout guards** - 15s limit on chat requests
- **Response compression** - Gzip on production
- **Request caching** - Consider Redis for identical requests

## Security Considerations

### Frontend

- ✅ Strict type validation on all API responses
- ✅ No direct XSS vectors (React Native, not web)
- ✅ Sensitive data not logged
- ✅ Request timeouts prevent hanging requests

### Backend

- ⚠️ Enable CORS with specific origins in production
- ⚠️ Add authentication (JWT/API keys)
- ⚠️ Rate limiting per user/IP
- ⚠️ Input sanitization (XSS, injection)
- ⚠️ Validate Gemini API key is private

### API Security

```typescript
// Production CORS setup
app.use(
  cors({
    origin: "https://intelligent-bistro.app",
    credentials: true,
  }),
);

// Rate limiting
import rateLimit from "express-rate-limit";
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);

// Authentication
app.use((req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});
```

## Future Enhancements

### Short Term

- [ ] Multi-step intent clarification ("Did you mean 2 or 3?")
- [ ] Order modification ("Change the cola to water")
- [ ] Undo/redo functionality
- [ ] Order history
- [ ] Voice input support

### Medium Term

- [ ] Subscription management (remember favorites)
- [ ] Allergy warnings
- [ ] Real-time order status
- [ ] Multiple cart support (save orders)
- [ ] Backend persistence (orders database)

### Long Term

- [ ] Fine-tuning Gemini on bistro-specific terminology
- [ ] Multi-language support
- [ ] A/B testing different AI prompts
- [ ] Analytics on intent success rate
- [ ] Custom menu item suggestions

## Troubleshooting

### "Request timed out"

- Backend may be slow or unreachable
- Check `EXPO_PUBLIC_API_URL` is correct
- Verify backend is running: `curl http://localhost:3000/health`

### "Backend returned invalid data"

- Check backend logs for Gemini API errors
- Verify `GEMINI_API_KEY` is set in `apps/backend/.env`
- Confirm Gemini API quota hasn't been exceeded

### "Network error"

- Check device has internet connectivity
- On mobile, verify backend URL is accessible
- Try disabling CORS temporarily for debugging

### Cart doesn't sync

- Check `applyCartDelta` console logs
- Verify menu items exist (invalid item IDs silently fail)
- Check cart prices are accurate

### Tests failing

- Ensure all dependencies installed: `npm install && cd apps/backend && npm install`
- Check Node.js version (16+)
- Run `npm run test -- --update` to update snapshots

## Support & Documentation

- **Expo documentation**: https://docs.expo.dev/
- **React Native**: https://reactnative.dev/
- **Zustand**: https://github.com/pmndrs/zustand
- **Gemini API**: https://ai.google.dev/
- **Express.js**: https://expressjs.com/

---

**Built with ❤️ for premium restaurant ordering experiences.**

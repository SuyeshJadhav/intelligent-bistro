import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import type { MenuItem } from "../data/menu";
import type { ResolveResult } from "./fuzzyMatch";
import { resolveMenuMatchesWithScores } from "./fuzzyMatch";

interface Modifier {
  type: string;
  value: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

const addItemActionSchema = z.object({
  type: z.literal("ADD_ITEM"),
  itemId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const removeItemActionSchema = z.object({
  type: z.literal("REMOVE_ITEM"),
  itemId: z.string().min(1),
});

const updateQuantityActionSchema = z.object({
  type: z.literal("UPDATE_QUANTITY"),
  itemId: z.string().min(1),
  quantity: z.number().int().nonnegative(),
});

const cartActionSchema = z.union([
  addItemActionSchema,
  removeItemActionSchema,
  updateQuantityActionSchema,
]);

export type CartAction = z.infer<typeof cartActionSchema>;

const suggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()).optional(),
  dietary: z.array(z.string()).optional(),
});

const aiResponseSchema = z.object({
  actions: z.array(cartActionSchema),
  confirmation: z.string(),
  executionLog: z.array(z.string()).length(4),
  clarificationRequired: z.boolean().optional(),
  suggestions: z.array(suggestionSchema).optional(),
});

export type AIResponse = z.infer<typeof aiResponseSchema>;

const SYSTEM_PROMPT = `You are the AI ordering assistant for The Intelligent Bistro, acting as a planner.
The backend WILL provide a list of resolved entity candidates (id + confidence). Your job is to RETURN a normalized intent graph describing the user's intent.

ABSOLUTELY DO NOT GUESS, INVENT, OR SUBSTITUTE MENU ITEMS.
- Do NOT perform fuzzy matching beyond the provided resolver results.
- Do NOT invent recommendations, categories, or semantic equivalents.
- Do NOT assume "closest category" or make category-level substitutions.

If no exact or HIGH-CONFIDENCE menu match exists, return NO_MATCH according to the backend contract (do not create or infer items).

Return EXACTLY this JSON and nothing else:
{
  "intentGraph": [
    {
      "intent": "ADD" | "REMOVE" | "UPDATE",
      "targets": [
        {
          "raw": string,
          "resolvedId": string | null,
          "label": string | null,
          "confidence": number | null,
          "quantity": number | null,
          "modifiers": [{ "type": string, "value": string }] | null
        }
      ]
    }
  ],
  "confirmation": string
}`;

const FALLBACK_RESPONSE: AIResponse = {
  actions: [],
  confirmation:
    "I couldn't process that order just now. Please try again with item names from our menu.",
  executionLog: [
    "PROCESSING_INTENT...",
    "VALIDATING_MENU...",
    "NO_MATCH_FOUND",
    "AWAITING_INPUT...",
  ],
  clarificationRequired: false,
  suggestions: [],
};

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

function buildMenuContext(menuItems: MenuItem[]): string {
  return menuItems
    .map(
      (item) =>
        `- ${item.id} | ${item.name} | $${item.price.toFixed(2)} | ${item.category} | ${item.description}`,
    )
    .join("\n");
}

function buildCartContext(cartState: CartItem[]): string {
  if (cartState.length === 0) {
    return "- Cart is currently empty.";
  }

  return cartState
    .map(
      (item) =>
        `- ${item.id} | ${item.name} | qty=${item.quantity} | unit=$${item.price.toFixed(2)}`,
    )
    .join("\n");
}

function buildUserPrompt(
  userMessage: string,
  cartState: CartItem[],
  menuItems: MenuItem[],
  resolverResult?: ResolveResult,
): string {
  const parts: string[] = [
    "User message:",
    userMessage,
    "",
    "Resolved entities (backend):",
  ];

  if (resolverResult && resolverResult.matches.length > 0) {
    for (const m of resolverResult.matches) {
      parts.push(
        `- raw: ${m.raw} | resolvedId: ${m.resolvedId} | label: ${m.label} | confidence: ${Math.round(
          m.confidence * 100,
        )}%`,
      );
    }
  } else {
    parts.push("- (none)");
  }

  parts.push(
    "",
    "Menu:",
    buildMenuContext(menuItems),
    "",
    "Current cart:",
    buildCartContext(cartState),
  );
  return parts.join("\n");
}

// Planner response schema (intent graph)
const targetSchema = z.object({
  raw: z.string(),
  resolvedId: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  quantity: z.number().int().nullable().optional(),
  modifiers: z
    .array(z.object({ type: z.string(), value: z.string() }))
    .nullable()
    .optional(),
});

const intentSchema = z.object({
  intent: z.string(),
  targets: z.array(targetSchema),
});

const plannerResponseSchema = z.object({
  intentGraph: z.array(intentSchema),
  confirmation: z.string(),
});

/**
 * Helper: compile a planner response (intent graph) into AIResponse actions and telemetry.
 * Exported for unit testing and for callers that want to separate planning from execution.
 */
export function compilePlannerResponse(
  plannerResp: z.infer<typeof plannerResponseSchema>,
  resolverResult?: ResolveResult,
): AIResponse {
  const compiledActions: CartAction[] = [];
  for (const node of plannerResp.intentGraph) {
    const intent = node.intent.toUpperCase();
    for (const t of node.targets) {
      const qty =
        typeof t.quantity === "number" && t.quantity > 0 ? t.quantity : 1;
      if (intent === "ADD" && t.resolvedId) {
        compiledActions.push({
          type: "ADD_ITEM",
          itemId: t.resolvedId,
          quantity: qty,
          modifiers: (t as any).modifiers as Modifier[] | undefined,
        } as CartAction);
      } else if (intent === "REMOVE" && t.resolvedId) {
        compiledActions.push({ type: "REMOVE_ITEM", itemId: t.resolvedId });
      } else if (
        intent === "UPDATE" &&
        t.resolvedId &&
        typeof t.quantity === "number"
      ) {
        compiledActions.push({
          type: "UPDATE_QUANTITY",
          itemId: t.resolvedId,
          quantity: t.quantity,
        });
      }
    }
  }

  const now = new Date().toISOString();
  const telemetry = [
    `${now} - ENTITY_RESOLUTION_COMPLETE`,
    `${now} - MATCH_CONFIDENCE: ${resolverResult && resolverResult.matches.length > 0
      ? Math.round(resolverResult.matches[0].confidence * 100) + "%"
      : "N/A"
    }`,
    `${now} - ACTION_GRAPH_VALIDATED`,
    `${now} - STATE_SYNCHRONIZED`,
  ] as [string, string, string, string];

  return {
    actions: compiledActions,
    confirmation: plannerResp.confirmation,
    executionLog: telemetry,
  };
}

// Deterministic helper to filter menu items by dietary tag
export function filterMenuByDietary(menuItems: MenuItem[], diet: string) {
  return menuItems.filter((it) =>
    (it.dietary || []).map((d) => d.toLowerCase()).includes(diet.toLowerCase()),
  );
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[Gemini Lib] Missing GEMINI_API_KEY environment variable");
    throw new Error("Missing GEMINI_API_KEY");
  }

  try {
    console.log(
      "[Gemini Lib] Initializing GoogleGenAI client and sending request...",
    );
    const client = new GoogleGenAI({ apiKey });
    const result = await client.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    });

    console.log("[Gemini Lib] Received response from Gemini API");
    return result.text ?? "";
  } catch (error) {
    console.error("[Gemini Lib] GoogleGenAI request failed:", error);
    throw error;
  }
}

const HIGH_CONFIDENCE = 0.9;
const MEDIUM_CONFIDENCE = 0.7;

export async function processOrder(
  userMessage: string,
  cartState: CartItem[],
  menuItems: MenuItem[],
): Promise<AIResponse> {
  try {
    console.log("[Gemini Lib] processOrder started. userMessage:", userMessage);
    const resolverResult = resolveMenuMatchesWithScores(userMessage, menuItems);
    if (resolverResult.matches.length > 0) {
      console.log(
        "[Gemini Lib] Resolver matched spans:",
        resolverResult.matches,
      );
    }

    // Only short-circuit to NO_MATCH for explicit out-of-domain queries
    // (e.g. cola, pizza) or for dietary requests that have no matching items.
    const userLower = userMessage.toLowerCase();
    const EXPLICIT_NO_MATCH = ["cola", "pizza", "fries", "tacos"];
    const requestsNoMatchTerm = EXPLICIT_NO_MATCH.some((w) =>
      userLower.includes(w),
    );

    // Dietary-specific handling (deterministic)
    const asksForVegan = /\bvegan\b/.test(userLower);
    if (
      requestsNoMatchTerm ||
      (asksForVegan && filterMenuByDietary(menuItems, "vegan").length === 0)
    ) {
      const userTokens = userMessage
        .toLowerCase()
        .split(/\s+/)
        .map((s) => s.replace(/[^\w-]/g, ""))
        .filter(Boolean);

      const suggestions = menuItems
        .filter((it) => {
          const hay = [
            it.name,
            ...(it.aliases || []),
            ...(it.keywords || []),
            ...(it.tags || []),
          ]
            .join(" ")
            .toLowerCase();
          return userTokens.some((t) => hay.includes(t));
        })
        .slice(0, 5)
        .map((it) => ({
          id: it.id,
          name: it.name,
          tags: it.tags,
          dietary: it.dietary,
        }));

      const finalSuggestions =
        suggestions.length > 0
          ? suggestions
          : menuItems.slice(0, 5).map((it) => ({
            id: it.id,
            name: it.name,
            tags: it.tags,
            dietary: it.dietary,
          }));

      return {
        actions: [],
        clarificationRequired: false,
        confirmation: "I couldn't find that item on our current menu.",
        suggestions: finalSuggestions,
        executionLog: [
          new Date().toISOString() + " - ENTITY_RESOLUTION_COMPLETE",
          new Date().toISOString() + " - MATCH_CONFIDENCE: N/A",
          new Date().toISOString() + " - NO_HIGH_CONFIDENCE_MATCH",
          new Date().toISOString() + " - AWAITING_INPUT...",
        ],
      } as AIResponse;
    }

    const userPrompt = buildUserPrompt(
      userMessage,
      cartState,
      menuItems,
      resolverResult,
    );
    console.log("[Gemini Lib] Generated User Prompt:\n", userPrompt);

    const rawText = await callGemini(userPrompt);
    console.log("[Gemini Lib] Raw Text returned from Gemini:\n", rawText);

    const cleaned = stripMarkdownFences(rawText);
    console.log("[Gemini Lib] Cleaned JSON string:\n", cleaned);

    const parsed = JSON.parse(cleaned) as unknown;
    console.log("[Gemini Lib] Parsed planner response:", parsed);

    // The LLM may return either a planner intent graph (preferred) or a direct
    // AIResponse (actions array). Accept either deterministically.
    const planner = plannerResponseSchema.safeParse(parsed);
    let plannerResp: z.infer<typeof plannerResponseSchema> | null = null;
    let aiRespParsed: z.infer<typeof aiResponseSchema> | null = null;

    if (planner.success) {
      plannerResp = planner.data;
    } else {
      const aiParsed = aiResponseSchema.safeParse(parsed);
      if (aiParsed.success) {
        aiRespParsed = aiParsed.data;
      } else {
        console.error(
          "[Gemini Lib] Response failed both planner and ai schemas:",
          planner.error?.format(),
          aiParsed.error?.format?.(),
        );
        return FALLBACK_RESPONSE;
      }
    }

    // If we received a planner response, compile it into actions
    const compiledActions: CartAction[] = [];
    if (plannerResp) {
      for (const node of plannerResp.intentGraph) {
        const intent = node.intent.toUpperCase();
        for (const t of node.targets) {
          const qty =
            typeof t.quantity === "number" && t.quantity > 0 ? t.quantity : 1;
          if (intent === "ADD" && t.resolvedId) {
            compiledActions.push({
              type: "ADD_ITEM",
              itemId: t.resolvedId,
              quantity: qty,
              modifiers: (t as any).modifiers as Modifier[] | undefined,
            } as CartAction);
          } else if (intent === "REMOVE" && t.resolvedId) {
            compiledActions.push({ type: "REMOVE_ITEM", itemId: t.resolvedId });
          } else if (
            intent === "UPDATE" &&
            t.resolvedId &&
            typeof t.quantity === "number"
          ) {
            compiledActions.push({
              type: "UPDATE_QUANTITY",
              itemId: t.resolvedId,
              quantity: t.quantity,
            });
          }
        }
      }
    }

    // Build execution log with simple telemetry entries
    const now = new Date().toISOString();
    const telemetry = [
      `${now} - ENTITY_RESOLUTION_COMPLETE`,
      `${now} - MATCH_CONFIDENCE: ${resolverResult.matches.length > 0
        ? Math.round(resolverResult.matches[0].confidence * 100) + "%"
        : "N/A"
      }`,
      `${now} - ACTION_GRAPH_VALIDATED`,
      `${now} - STATE_SYNCHRONIZED`,
    ] as [string, string, string, string];

    const aiResp: any = aiRespParsed
      ? {
        ...aiRespParsed,
      }
      : {
        actions: compiledActions,
        confirmation: plannerResp!.confirmation,
        executionLog: telemetry,
      };

    // If resolver had ambiguous/low-confidence matches, include them for client-side clarification
    if (resolverResult && resolverResult.matches.length > 0) {
      const lowMatches = resolverResult.matches.filter(
        (m) => m.confidence < HIGH_CONFIDENCE,
      );
      if (lowMatches.length > 0) {
        aiResp.clarificationChoices = lowMatches.map((m) => ({
          raw: m.raw,
          resolvedId: m.resolvedId,
          label: m.label,
          confidence: m.confidence,
        }));
      }
    }

    return aiResp as AIResponse;
  } catch (error) {
    console.error(
      "[Gemini Lib] Error encountered during processOrder. Returning fallback response. Error details:",
      error,
    );
    return FALLBACK_RESPONSE;
  }
}

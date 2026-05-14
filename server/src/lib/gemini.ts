import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import type { MenuItem } from "../data/menu";

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

const aiResponseSchema = z.object({
  actions: z.array(cartActionSchema),
  confirmation: z.string(),
  executionLog: z.array(z.string()).length(4),
});

export type AIResponse = z.infer<typeof aiResponseSchema>;

const SYSTEM_PROMPT = `You are the AI ordering assistant for The Intelligent Bistro, a premium restaurant.
Your job is to interpret the user's natural language order intent and return structured JSON.

You have access to the current menu and the user's current cart state.
You must ONLY reference items that exist in the menu by their exact id.
Never hallucinate menu items.

Always respond with this exact JSON shape and nothing else:
{
  "actions": [
    { "type": "ADD_ITEM", "itemId": string, "quantity": number },
    { "type": "REMOVE_ITEM", "itemId": string },
    { "type": "UPDATE_QUANTITY", "itemId": string, "quantity": number }
  ],
  "confirmation": string,
  "executionLog": [
    "PROCESSING_INTENT...",
    "VALIDATING_MENU...",
    "UPDATING_STATE...",
    "SYNC_COMPLETE"
  ]
}

If the user's request is unclear or references items not on the menu, return:
{
  "actions": [],
  "confirmation": "I couldn't find that item on our menu. Here's what we have: [list relevant categories].",
  "executionLog": ["PROCESSING_INTENT...", "VALIDATING_MENU...", "NO_MATCH_FOUND", "AWAITING_INPUT..."]
}

Never include markdown, explanation, or any text outside the JSON object.`;

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
): string {
  return [
    "User message:",
    userMessage,
    "",
    "Menu:",
    buildMenuContext(menuItems),
    "",
    "Current cart:",
    buildCartContext(cartState),
  ].join("\n");
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[Gemini Lib] Missing GEMINI_API_KEY environment variable");
    throw new Error("Missing GEMINI_API_KEY");
  }

  try {
    console.log("[Gemini Lib] Initializing GoogleGenAI client and sending request...");
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

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + indicator
      );
    }
  }
  return matrix[a.length][b.length];
}

function resolveMenuMatches(text: string, menuItems: MenuItem[]): string {
  let resolvedText = text;
  const sortedItems = [...menuItems].sort((a, b) => b.name.length - a.name.length);
  const words = text.split(/\s+/);
  const matchedIndices = new Set<number>();
  
  for (let n = 4; n >= 1; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      let overlap = false;
      for (let k = i; k < i + n; k++) {
        if (matchedIndices.has(k)) overlap = true;
      }
      if (overlap) continue;
      
      const ngram = words.slice(i, i + n).join(" ");
      const normalizedNgram = ngram.toLowerCase().replace(/[^\w\s]/g, "");
      
      if (normalizedNgram.length < 3) continue;
      
      let bestMatch: MenuItem | null = null;
      let bestDistance = Infinity;
      
      for (const item of sortedItems) {
        const targetName = item.name.toLowerCase().replace(/[^\w\s]/g, "");
        const targetId = item.id.toLowerCase().replace(/-/g, " ");
        
        const distName = levenshteinDistance(normalizedNgram, targetName);
        const distId = levenshteinDistance(normalizedNgram, targetId);
        
        const minDist = Math.min(distName, distId);
        const threshold = Math.max(1, Math.floor(Math.max(targetName.length, targetId.length) * 0.3));
        
        if (minDist <= threshold && minDist < bestDistance) {
          if (minDist <= Math.floor(normalizedNgram.length * 0.5)) {
             bestDistance = minDist;
             bestMatch = item;
          }
        }
      }
      
      if (bestMatch) {
        const escapedNgram = ngram.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<![\\w])${escapedNgram}(?![\\w])`, "i");
        if (regex.test(resolvedText)) {
            resolvedText = resolvedText.replace(regex, bestMatch.id);
            for (let k = i; k < i + n; k++) matchedIndices.add(k);
        }
      }
    }
  }
  
  return resolvedText;
}

export async function processOrder(
  userMessage: string,
  cartState: CartItem[],
  menuItems: MenuItem[],
): Promise<AIResponse> {
  try {
    console.log("[Gemini Lib] processOrder started. userMessage:", userMessage);
    
    const resolvedMessage = resolveMenuMatches(userMessage, menuItems);
    if (resolvedMessage !== userMessage) {
        console.log("[Gemini Lib] Semantic match resolved message to:", resolvedMessage);
    }
    
    const userPrompt = buildUserPrompt(resolvedMessage, cartState, menuItems);
    console.log("[Gemini Lib] Generated User Prompt:\n", userPrompt);

    const rawText = await callGemini(userPrompt);
    console.log("[Gemini Lib] Raw Text returned from Gemini:\n", rawText);

    const cleaned = stripMarkdownFences(rawText);
    console.log("[Gemini Lib] Cleaned JSON string:\n", cleaned);

    const parsed = JSON.parse(cleaned) as unknown;
    console.log("[Gemini Lib] Successfully parsed JSON:", parsed);

    const validated = aiResponseSchema.parse(parsed);
    console.log("[Gemini Lib] Successfully validated AI response schema");
    return validated;
  } catch (error) {
    console.error("[Gemini Lib] Error encountered during processOrder. Returning fallback response. Error details:", error);
    return FALLBACK_RESPONSE;
  }
}

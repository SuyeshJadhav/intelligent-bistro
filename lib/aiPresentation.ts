import { menuData } from "@/constants/menuData";

export interface AIMessageParagraphBlock {
  type: "paragraph";
  text: string;
}

export interface AIMessageListItem {
  raw: string;
  label: string;
  detail?: string;
  price?: string;
}

export interface AIMessageListBlock {
  type: "list";
  items: AIMessageListItem[];
}

export type AIMessageBlock = AIMessageParagraphBlock | AIMessageListBlock;

export interface ExecutionLogPresentation {
  label: string;
  detail?: string;
  isDevOnly?: boolean;
}

const BULLET_LINE_PATTERN = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;
const PRICE_LINE_PATTERN =
  /^(.*?)(?:\s+[—–:]\s+|\s+-\s+|\s{2,}|\s+)(\$?\d+(?:\.\d{1,2})?)$/;
const TIMESTAMP_PREFIX_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?\s+-\s+/;

type MenuCatalogItem = {
  name: string;
  price: number;
};

const MENU_CATALOG = menuData as MenuCatalogItem[];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripTimestampPrefix(entry: string) {
  return entry.replace(TIMESTAMP_PREFIX_PATTERN, "");
}

function parseListItem(rawItem: string): AIMessageListItem {
  const raw = rawItem.trim();
  const match = raw.match(PRICE_LINE_PATTERN);

  if (!match) {
    return {
      raw,
      label: raw,
    };
  }

  const label = normalizeWhitespace(match[1] ?? raw);
  const price = normalizeWhitespace(match[2] ?? "");

  return {
    raw,
    label,
    price: price || undefined,
  };
}

function parseListBlock(lines: string[]): AIMessageListBlock {
  return {
    type: "list",
    items: lines.map(parseListItem),
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatPrice(price: number) {
  return `$${price.toFixed(Number.isInteger(price) ? 0 : 2).replace(/\.00$/, "")}`;
}

function extractCatalogItems(text: string) {
  const matches = MENU_CATALOG.flatMap((item) => {
    const pattern = new RegExp(`\\b${escapeRegExp(item.name)}\\b`, "i");
    const match = text.match(pattern);

    if (!match) {
      return [];
    }

    return [
      {
        raw: item.name,
        label: item.name,
        price: formatPrice(item.price),
        index: match.index ?? Number.POSITIVE_INFINITY,
        endIndex: (match.index ?? 0) + match[0].length,
      },
    ];
  });

  return matches.sort((a, b) => a.index - b.index);
}

function buildCatalogListBlocks(text: string): AIMessageBlock[] {
  if (text.split("\n").some((line) => BULLET_LINE_PATTERN.test(line.trim()))) {
    return [];
  }

  const catalogItems = extractCatalogItems(text);
  if (catalogItems.length < 2) {
    return [];
  }

  const headerMatch = text.match(
    /^(.*?)(?:including|available|offering|features|with)\b/i,
  );
  const firstItemStart = catalogItems[0]?.index ?? 0;
  const lastItemEnd =
    catalogItems[catalogItems.length - 1]?.endIndex ?? text.length;
  const leadText =
    normalizeWhitespace(
      text
        .slice(0, firstItemStart)
        .replace(
          /\s*(including(?:\s+the)?|available|offering|features|with|the)\s*$/i,
          "",
        ),
    ) ||
    normalizeWhitespace(headerMatch?.[1] ?? "") ||
    "Available drinks:";
  const trailingText = normalizeWhitespace(
    text.slice(lastItemEnd).replace(/^[,.;:\s-]+/, ""),
  );

  const blocks: AIMessageBlock[] = [];
  if (leadText) {
    blocks.push({
      type: "paragraph",
      text:
        leadText
          .replace(/\s*(including|available|offering|features|with)\s*$/i, "")
          .trim() || "Available drinks:",
    });
  }

  blocks.push({
    type: "list",
    items: catalogItems.map(({ raw, label, price }) => ({ raw, label, price })),
  });

  if (trailingText) {
    blocks.push({
      type: "paragraph",
      text: trailingText,
    });
  }

  return blocks;
}

function flushParagraph(buffer: string[], blocks: AIMessageBlock[]) {
  if (buffer.length === 0) {
    return;
  }

  blocks.push({
    type: "paragraph",
    text: buffer.join(" ").replace(/\s+/g, " ").trim(),
  });
  buffer.length = 0;
}

function flushList(buffer: string[], blocks: AIMessageBlock[]) {
  if (buffer.length === 0) {
    return;
  }

  blocks.push(parseListBlock(buffer));
  buffer.length = 0;
}

export function formatAIMessageContent(content: string): AIMessageBlock[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const catalogBlocks = buildCatalogListBlocks(normalized);
  if (catalogBlocks.length > 0) {
    return catalogBlocks;
  }

  const lines = normalized.split("\n");
  const blocks: AIMessageBlock[] = [];
  const paragraphBuffer: string[] = [];
  const listBuffer: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listBuffer, blocks);
      continue;
    }

    const bulletMatch = trimmed.match(BULLET_LINE_PATTERN);
    if (bulletMatch) {
      flushParagraph(paragraphBuffer, blocks);
      listBuffer.push(bulletMatch[1] ?? trimmed);
      continue;
    }

    if (listBuffer.length > 0) {
      flushList(listBuffer, blocks);
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph(paragraphBuffer, blocks);
  flushList(listBuffer, blocks);

  return blocks;
}

function parseConfidence(raw: string) {
  const match = raw.match(/(\d+(?:\.\d+)?)\s*%/);
  return match?.[1] ?? null;
}

export function formatExecutionLogEntry(
  entry: string,
  options: { isDevelopment?: boolean } = {},
): ExecutionLogPresentation {
  const isDevelopment = options.isDevelopment ?? false;
  const normalized = stripTimestampPrefix(entry.trim());

  if (
    /^PROCESSING_INTENT/.test(normalized) ||
    /^UNDERSTANDING_REQUEST/.test(normalized)
  ) {
    return { label: "Understanding your request…" };
  }

  if (
    /^VALIDATING_MENU/.test(normalized) ||
    /^ENTITY_RESOLUTION/.test(normalized) ||
    /^ACTION_GRAPH_VALIDATED/.test(normalized) ||
    /^MATCHING_MENU_ITEMS/.test(normalized)
  ) {
    return { label: "Matching menu items…" };
  }

  if (
    /^APPLYING_MUTATIONS/.test(normalized) ||
    /^UPDATING_STATE/.test(normalized)
  ) {
    return { label: "Updating your order…" };
  }

  if (
    /^STATE_SYNCHRONIZED/.test(normalized) ||
    /^SYNC_COMPLETE/.test(normalized)
  ) {
    return { label: "Order synchronized" };
  }

  if (/^NO_MATCH_FOUND/.test(normalized)) {
    return { label: "No close match found" };
  }

  if (/^AWAITING_INPUT/.test(normalized)) {
    return { label: "Awaiting your input…" };
  }

  if (/^CLARIFICATION_REQUIRED/.test(normalized)) {
    return { label: "Confirming your selection…" };
  }

  if (/^CLARIFICATION_ACCEPTED/.test(normalized)) {
    return { label: "Clarification confirmed" };
  }

  if (
    /^CLARIFICATION_CONTEXT_EXPIRED/.test(normalized) ||
    /^CONTEXT_INVALIDATED/.test(normalized)
  ) {
    return { label: "Request context refreshed" };
  }

  if (/^RETRYING/.test(normalized)) {
    return { label: "Trying again…" };
  }

  if (/^OFFLINE_ERROR/.test(normalized)) {
    return { label: "Connection issue" };
  }

  if (/^TIMEOUT_ERROR/.test(normalized)) {
    return { label: "Request taking longer than expected" };
  }

  if (/^VALIDATION_ERROR/.test(normalized)) {
    return { label: "Response validation issue" };
  }

  if (/^DEBOUNCE_ERROR/.test(normalized)) {
    return { label: "Please wait a moment" };
  }

  if (/^ERROR/.test(normalized)) {
    return { label: "Something went wrong" };
  }

  if (/^MATCH_CONFIDENCE/.test(normalized)) {
    const confidence = parseConfidence(normalized);
    if (isDevelopment && confidence) {
      return {
        label: `Match confidence ${confidence}%`,
        detail: normalized,
        isDevOnly: true,
      };
    }

    return {
      label: confidence ? "Closest match found" : "Confirming your selection…",
      detail: isDevelopment ? normalized : undefined,
      isDevOnly: Boolean(confidence),
    };
  }

  if (isDevelopment) {
    return {
      label: normalized,
      detail: normalized,
    };
  }

  return {
    label: "System update",
  };
}

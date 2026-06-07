// ============================================================
// DeFi Copilot — Intent Parser Service
// Parses natural-language messages into structured intents
// using a single merged LLM call (Claude Sonnet via Bedrock)
// ============================================================

import { buildLLMContext, callLLM } from "./llm-client";
import {
  IntentParserInput,
  IntentParserOutput,
  StructuredIntent,
  SwapIntent,
  StakeIntent,
  MemoryRecord,
  AppError,
  ErrorCode,
} from "../types";
import { isTokenSupported } from "../types/config";

// --- Main Entry Point ---

/**
 * Parse a user message into a structured intent with risk flags.
 * Assembles LLM context, calls LLM, validates and post-processes the response.
 */
export async function parseIntent(
  input: IntentParserInput
): Promise<IntentParserOutput> {
  // 1. Build LLM context from input
  const context = buildLLMContext(input);

  // 2. Call LLM — AppError (timeout/error) re-throws to orchestrator
  const rawResponse = await callLLM(context);

  // 3. Parse JSON response
  const parsed = parseJSON(rawResponse);
  if (!parsed) {
    return buildClarification(
      "I had trouble understanding that. Could you rephrase your request?"
    );
  }

  // 4. Extract fields from parsed response
  const reasoning = parsed.reasoning || "";
  const clarification = parsed.clarification || null;
  const riskFlags = extractRiskFlags(parsed);
  const memoryIndicator = parsed.memoryIndicator || null;
  let intent: StructuredIntent | null = parsed.intent || null;

  // 5. If LLM already returned clarification, pass it through
  if (!intent && clarification) {
    return {
      reasoning,
      intent: null,
      clarification,
      riskFlags,
      memoryIndicator,
    };
  }

  // 6. If both intent and clarification are null, ask user to be more specific
  if (!intent && !clarification) {
    return buildClarification(
      "I'm not sure what you'd like to do. Could you be more specific? I can help with swaps and staking on Sui."
    );
  }

  // 7. Validate the intent
  if (intent) {
    const validationResult = validateIntent(intent);
    if (validationResult) {
      return {
        reasoning,
        ...validationResult,
        riskFlags,
        memoryIndicator,
      };
    }
  }

  // 8. Apply memory preferences as defaults
  let appliedMemoryIndicator = memoryIndicator;
  if (intent && intent.action === "swap") {
    const memoryResult = applyMemoryPreferences(
      intent as SwapIntent,
      input.memories
    );
    intent = memoryResult.intent;
    if (memoryResult.memoryIndicator) {
      appliedMemoryIndicator = memoryResult.memoryIndicator;
    }
  }

  return {
    reasoning,
    intent,
    clarification: null,
    riskFlags,
    memoryIndicator: appliedMemoryIndicator,
  };
}

// --- JSON Parsing ---

function parseJSON(raw: string): ParsedLLMResponse | null {
  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

interface ParsedLLMResponse {
  reasoning?: string;
  intent?: StructuredIntent | null;
  clarification?: string | null;
  riskFlags?: {
    slippageConcern?: boolean;
    concentrationConcern?: boolean;
    rationale?: string;
  };
  memoryIndicator?: string | null;
}

// --- Risk Flag Extraction ---

function extractRiskFlags(parsed: ParsedLLMResponse): IntentParserOutput["riskFlags"] {
  const flags = parsed.riskFlags;
  return {
    slippageConcern: flags?.slippageConcern ?? false,
    concentrationConcern: flags?.concentrationConcern ?? false,
    rationale: flags?.rationale ?? "",
  };
}

// --- Intent Validation ---

/**
 * Validates the structured intent. Returns partial output if invalid, or null if valid.
 */
function validateIntent(
  intent: StructuredIntent
): Pick<IntentParserOutput, "intent" | "clarification" | "memoryIndicator"> | null {
  if (intent.action === "swap") {
    return validateSwapIntent(intent as SwapIntent);
  }
  if (intent.action === "stake") {
    return validateStakeIntent(intent as StakeIntent);
  }
  return null;
}

function validateSwapIntent(
  intent: SwapIntent
): Pick<IntentParserOutput, "intent" | "clarification" | "memoryIndicator"> | null {
  // Check for unknown tokens first
  if (intent.fromToken && !isTokenSupported(intent.fromToken)) {
    return {
      intent: null,
      clarification: `I don't recognize the token "${intent.fromToken}". Could you check the token name? Supported tokens are: SUI, USDC, USDT, WETH, CETUS.`,
      memoryIndicator: null,
    };
  }
  if (intent.toToken && !isTokenSupported(intent.toToken)) {
    return {
      intent: null,
      clarification: `I don't recognize the token "${intent.toToken}". Could you check the token name? Supported tokens are: SUI, USDC, USDT, WETH, CETUS.`,
      memoryIndicator: null,
    };
  }

  // Check for missing required fields
  const missingFields: string[] = [];
  if (!intent.fromToken) missingFields.push("source token");
  if (!intent.toToken) missingFields.push("target token");
  if (!intent.amount || intent.amount <= 0) missingFields.push("amount");

  if (missingFields.length > 0) {
    return {
      intent: null,
      clarification: `I need a bit more info to process your swap. Could you specify the ${missingFields.join(", ")}?`,
      memoryIndicator: null,
    };
  }

  return null; // Valid
}

function validateStakeIntent(
  intent: StakeIntent
): Pick<IntentParserOutput, "intent" | "clarification" | "memoryIndicator"> | null {
  // Stake token must be SUI — reject anything else
  if (intent.token && !isTokenSupported(intent.token)) {
    return {
      intent: null,
      clarification: `I don't recognize the token "${intent.token}". Could you check the token name? Supported tokens are: SUI, USDC, USDT, WETH, CETUS.`,
      memoryIndicator: null,
    };
  }

  const missingFields: string[] = [];
  if (!intent.amount || intent.amount <= 0) missingFields.push("amount");

  if (missingFields.length > 0) {
    return {
      intent: null,
      clarification: `I need a bit more info to process your stake. Could you specify the ${missingFields.join(", ")}?`,
      memoryIndicator: null,
    };
  }

  return null; // Valid
}

// --- Unknown Token Error ---

/**
 * Creates an error output for an unrecognized token symbol.
 */
export function buildUnknownTokenError(symbol: string): IntentParserOutput {
  return {
    reasoning: `The token "${symbol}" is not recognized.`,
    intent: null,
    clarification: `I don't recognize the token "${symbol}". Could you check the token name? Supported tokens are: SUI, USDC, USDT, WETH, CETUS.`,
    riskFlags: {
      slippageConcern: false,
      concentrationConcern: false,
      rationale: "",
    },
    memoryIndicator: null,
  };
}

// --- Memory Preference Application ---

interface MemoryApplyResult {
  intent: SwapIntent;
  memoryIndicator: string | null;
}

/**
 * Applies memory preferences as defaults to the intent.
 * Looks for DEX preference in recalled memories.
 */
function applyMemoryPreferences(
  intent: SwapIntent,
  memories: MemoryRecord[]
): MemoryApplyResult {
  // Only apply if dex is not already set
  if (intent.dex) {
    return { intent, memoryIndicator: null };
  }

  // Look for DEX preference in memories
  const dexPreference = findDexPreference(memories);
  if (dexPreference) {
    return {
      intent: { ...intent, dex: dexPreference },
      memoryIndicator: `Using ${dexPreference} (your preferred DEX)`,
    };
  }

  return { intent, memoryIndicator: null };
}

/**
 * Searches memories for a DEX preference.
 */
function findDexPreference(memories: MemoryRecord[]): string | null {
  if (!memories || memories.length === 0) return null;

  for (const mem of memories) {
    if (mem.type !== "preference") continue;

    // Look for DEX-related content
    const content = mem.content;
    if (content.toLowerCase().includes("dex")) {
      // Extract DEX name from content like "Preferred DEX: Cetus" or "I prefer Cetus for DEX"
      const colonMatch = content.match(/(?:dex|DEX)[:\s]+(\w+)/i);
      if (colonMatch) {
        return colonMatch[1];
      }

      // Try alternate patterns: "prefers X", "prefer X", "use X"
      const preferMatch = content.match(/(?:prefers?|uses?|likes?)\s+(\w+)/i);
      if (preferMatch) {
        return preferMatch[1];
      }
    }
  }

  return null;
}

// --- Helpers ---

function buildClarification(message: string): IntentParserOutput {
  return {
    reasoning: "",
    intent: null,
    clarification: message,
    riskFlags: {
      slippageConcern: false,
      concentrationConcern: false,
      rationale: "",
    },
    memoryIndicator: null,
  };
}

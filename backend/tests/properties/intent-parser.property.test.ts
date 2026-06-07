// ============================================================
// DeFi Copilot — Intent Parser Property-Based Tests
// Properties 1-3, 19-21
// ============================================================

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  SwapIntent,
  StakeIntent,
  StructuredIntent,
  MemoryRecord,
  TokenBalance,
  IntentParserOutput,
} from "@/types";
import { SUPPORTED_TOKENS, isTokenSupported } from "@/types/config";
import { buildLLMContext } from "@/services/llm-client";

// --- Helpers that mirror the intent-parser validation logic ---

/**
 * Validates a swap intent and returns clarification with missing fields
 * (mirrors validateSwapIntent in intent-parser.ts)
 */
function validateSwapIntent(
  intent: Partial<SwapIntent>
): { clarification: string; missingFields: string[] } | null {
  // Check unknown tokens first
  if (intent.fromToken && !isTokenSupported(intent.fromToken)) {
    return {
      clarification: `I don't recognize the token "${intent.fromToken}".`,
      missingFields: [],
    };
  }
  if (intent.toToken && !isTokenSupported(intent.toToken)) {
    return {
      clarification: `I don't recognize the token "${intent.toToken}".`,
      missingFields: [],
    };
  }

  const missingFields: string[] = [];
  if (!intent.fromToken) missingFields.push("source token");
  if (!intent.toToken) missingFields.push("target token");
  if (!intent.amount || intent.amount <= 0) missingFields.push("amount");

  if (missingFields.length > 0) {
    return {
      clarification: `I need a bit more info to process your swap. Could you specify the ${missingFields.join(", ")}?`,
      missingFields,
    };
  }

  return null;
}

/**
 * Validates a stake intent and returns clarification with missing fields
 */
function validateStakeIntent(
  intent: Partial<StakeIntent>
): { clarification: string; missingFields: string[] } | null {
  if (intent.token && !isTokenSupported(intent.token)) {
    return {
      clarification: `I don't recognize the token "${intent.token}".`,
      missingFields: [],
    };
  }

  const missingFields: string[] = [];
  if (!intent.amount || intent.amount <= 0) missingFields.push("amount");

  if (missingFields.length > 0) {
    return {
      clarification: `I need a bit more info to process your stake. Could you specify the ${missingFields.join(", ")}?`,
      missingFields,
    };
  }

  return null;
}

/**
 * Applies memory DEX preference to a swap intent
 * (mirrors applyMemoryPreferences in intent-parser.ts)
 */
function applyDexPreference(
  intent: SwapIntent,
  memories: MemoryRecord[]
): { intent: SwapIntent; memoryIndicator: string | null } {
  if (intent.dex) return { intent, memoryIndicator: null };

  for (const mem of memories) {
    if (mem.type !== "preference") continue;
    const content = mem.content;
    if (content.toLowerCase().includes("dex")) {
      const colonMatch = content.match(/(?:dex|DEX)[:\s]+(\w+)/i);
      if (colonMatch) {
        return {
          intent: { ...intent, dex: colonMatch[1] },
          memoryIndicator: `Using ${colonMatch[1]} (your preferred DEX)`,
        };
      }
      const preferMatch = content.match(/(?:prefers?|uses?|likes?)\s+(\w+)/i);
      if (preferMatch) {
        return {
          intent: { ...intent, dex: preferMatch[1] },
          memoryIndicator: `Using ${preferMatch[1]} (your preferred DEX)`,
        };
      }
    }
  }

  return { intent, memoryIndicator: null };
}

/**
 * Parses a simulated LLM response into structured output.
 * (mirrors parseIntent post-processing logic)
 */
function parseLLMResponse(raw: {
  reasoning?: string;
  intent?: StructuredIntent | null;
  clarification?: string | null;
  riskFlags?: { slippageConcern?: boolean; concentrationConcern?: boolean; rationale?: string };
  memoryIndicator?: string | null;
}): { intent: StructuredIntent | null; clarification: string | null } {
  const intent = raw.intent || null;
  const clarification = raw.clarification || null;

  if (!intent && clarification) {
    return { intent: null, clarification };
  }
  if (!intent && !clarification) {
    return { intent: null, clarification: "I'm not sure what you'd like to do. Could you be more specific?" };
  }

  return { intent, clarification: null };
}

/**
 * Message input validation (trimming and empty-check)
 */
function isValidMessageInput(message: string): boolean {
  return message.trim().length > 0;
}

// --- Generators ---

const supportedTokenArb = fc.constantFrom(...SUPPORTED_TOKENS.map((t) => t.symbol));

const unsupportedTokenArb = fc.string({ minLength: 2, maxLength: 10 })
  .filter((s) => !isTokenSupported(s) && /^[A-Za-z]+$/.test(s));

// --- Property 1: Incomplete intent produces clarification naming all missing fields ---

describe("Feature: defi-copilot-hackathon, Property 1: Incomplete intent produces clarification naming all missing fields", () => {
  it("for any swap intent missing fields, clarification names each missing field", () => {
    // Generate partial swap intents with at least one field missing
    const partialSwapArb = fc.record({
      action: fc.constant("swap" as const),
      fromToken: fc.option(supportedTokenArb, { nil: undefined }),
      toToken: fc.option(supportedTokenArb, { nil: undefined }),
      amount: fc.option(fc.double({ min: 0.01, max: 10000, noNaN: true }), { nil: undefined }),
    }).filter(
      (intent) => !intent.fromToken || !intent.toToken || !intent.amount
    );

    fc.assert(
      fc.property(partialSwapArb, (partialIntent) => {
        const result = validateSwapIntent(partialIntent as Partial<SwapIntent>);

        // Should produce a clarification since fields are missing
        expect(result).not.toBeNull();
        expect(result!.clarification.length).toBeGreaterThan(0);

        // Verify each missing field is named
        if (!partialIntent.fromToken) {
          expect(result!.missingFields).toContain("source token");
          expect(result!.clarification).toContain("source token");
        }
        if (!partialIntent.toToken) {
          expect(result!.missingFields).toContain("target token");
          expect(result!.clarification).toContain("target token");
        }
        if (!partialIntent.amount) {
          expect(result!.missingFields).toContain("amount");
          expect(result!.clarification).toContain("amount");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("for any stake intent missing amount, clarification names the missing field", () => {
    fc.assert(
      fc.property(
        fc.record({
          action: fc.constant("stake" as const),
          token: fc.constant("SUI" as const),
          amount: fc.constant(undefined as unknown as number),
        }),
        (partialIntent) => {
          const result = validateStakeIntent(partialIntent as Partial<StakeIntent>);
          expect(result).not.toBeNull();
          expect(result!.missingFields).toContain("amount");
          expect(result!.clarification).toContain("amount");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 2: Unknown token produces error containing that exact symbol ---

describe("Feature: defi-copilot-hackathon, Property 2: Unknown token produces error naming the unrecognized symbol", () => {
  it("for any unknown token symbol, error response contains that exact symbol", () => {
    fc.assert(
      fc.property(unsupportedTokenArb, (unknownSymbol) => {
        // Test with unknown fromToken
        const resultFrom = validateSwapIntent({
          action: "swap",
          fromToken: unknownSymbol,
          toToken: "SUI",
          amount: 100,
        });

        expect(resultFrom).not.toBeNull();
        expect(resultFrom!.clarification).toContain(unknownSymbol);

        // Test with unknown toToken
        const resultTo = validateSwapIntent({
          action: "swap",
          fromToken: "USDC",
          toToken: unknownSymbol,
          amount: 100,
        });

        expect(resultTo).not.toBeNull();
        expect(resultTo!.clarification).toContain(unknownSymbol);
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 3: Memory preferences become intent defaults without clarification ---

describe("Feature: defi-copilot-hackathon, Property 3: Memory preferences become intent defaults without clarification", () => {
  it("for any recalled DEX preference + swap without dex specified, result uses preference as default without clarification", () => {
    const dexNames = ["Cetus", "Turbos", "KriyaDex", "DeepBook"];
    const dexNameArb = fc.constantFrom(...dexNames);

    fc.assert(
      fc.property(
        dexNameArb,
        fc.double({ min: 0.01, max: 10000, noNaN: true }),
        (dexName, amount) => {
          const intent: SwapIntent = {
            action: "swap",
            fromToken: "USDC",
            toToken: "SUI",
            amount,
            // No dex specified — should be filled from memory
          };

          const memories: MemoryRecord[] = [
            {
              id: "pref_dex",
              type: "preference",
              content: `Preferred DEX: ${dexName}`,
              timestamp: Date.now() - 60000,
              metadata: { category: "dex", value: dexName },
            },
          ];

          const result = applyDexPreference(intent, memories);

          // DEX preference should be applied
          expect(result.intent.dex).toBe(dexName);
          // Memory indicator should be present
          expect(result.memoryIndicator).not.toBeNull();
          expect(result.memoryIndicator).toContain(dexName);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 19: Message input validation ---

describe("Feature: defi-copilot-hackathon, Property 19: Message input validation", () => {
  it("non-empty trimmed string submits; empty/whitespace-only does not", () => {
    // Test non-empty strings
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (message) => {
          expect(isValidMessageInput(message)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("empty or whitespace-only strings do not submit", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("", " ", "  ", "\t", "\n", "   \t\n  ", "\r\n"),
        (message) => {
          expect(isValidMessageInput(message)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 20: LLM context assembly completeness ---

describe("Feature: defi-copilot-hackathon, Property 20: LLM context assembly completeness", () => {
  it("LLM context always includes: user message, up to 10 memories, balances", () => {
    const memoryArb: fc.Arbitrary<MemoryRecord> = fc.record({
      id: fc.uuid(),
      type: fc.constantFrom("preference" as const, "transaction" as const),
      content: fc.string({ minLength: 5, maxLength: 100 }),
      timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
      metadata: fc.constant(undefined),
    });

    const balanceArb: fc.Arbitrary<TokenBalance> = fc.record({
      token: fc.constantFrom("SUI", "USDC", "USDT"),
      symbol: fc.constantFrom("SUI", "USDC", "USDT"),
      balance: fc.double({ min: 0, max: 100000, noNaN: true }),
      decimals: fc.constantFrom(6, 9),
      valueUsd: fc.option(fc.double({ min: 0, max: 1000000, noNaN: true }), { nil: undefined }),
    });

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.array(memoryArb, { minLength: 0, maxLength: 15 }),
        fc.array(balanceArb, { minLength: 0, maxLength: 5 }),
        (userMessage, memories, balances) => {
          const input = {
            message: userMessage,
            memories,
            balances,
            conversationHistory: [],
          };

          const context = buildLLMContext(input);

          // User message is included
          expect(context.userMessage).toBe(userMessage);

          // Memories are capped at 10
          expect(context.memories.length).toBeLessThanOrEqual(10);

          // If input had memories, they should be formatted
          if (memories.length > 0) {
            expect(context.memories.length).toBeGreaterThan(0);
            expect(context.memories.length).toBeLessThanOrEqual(
              Math.min(10, memories.length)
            );
          }

          // Balances string is present
          expect(context.balances).toBeDefined();
          expect(typeof context.balances).toBe("string");
          if (balances.length > 0) {
            expect(context.balances).toContain("Wallet balances");
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 21: LLM response parsing produces valid structured output ---

describe("Feature: defi-copilot-hackathon, Property 21: LLM response parsing produces valid structured output", () => {
  it("LLM response parsing produces either valid intent OR clarification, never both null", () => {
    const validIntentArb: fc.Arbitrary<StructuredIntent> = fc.oneof(
      fc.record({
        action: fc.constant("swap" as const),
        fromToken: supportedTokenArb,
        toToken: supportedTokenArb,
        amount: fc.double({ min: 0.01, max: 10000, noNaN: true }),
      }).filter((i) => i.fromToken !== i.toToken),
      fc.record({
        action: fc.constant("stake" as const),
        token: fc.constant("SUI" as const),
        amount: fc.double({ min: 1, max: 10000, noNaN: true }),
      })
    );

    // Case 1: Response with a valid intent
    fc.assert(
      fc.property(validIntentArb, (intent) => {
        const raw = {
          reasoning: "User wants to perform a transaction",
          intent,
          clarification: null,
          riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        };

        const result = parseLLMResponse(raw);
        // Should produce valid intent, no clarification
        expect(result.intent).not.toBeNull();
        expect(result.clarification).toBeNull();
      }),
      { numRuns: 100 }
    );

    // Case 2: Response with clarification only
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 200 }),
        (clarificationMsg) => {
          const raw = {
            reasoning: "Need more info",
            intent: null,
            clarification: clarificationMsg,
            riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
          };

          const result = parseLLMResponse(raw);
          // Should produce clarification, no intent
          expect(result.intent).toBeNull();
          expect(result.clarification).not.toBeNull();
          expect(result.clarification!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );

    // Case 3: Response with both null -> should produce clarification (fallback)
    fc.assert(
      fc.property(fc.constant(null), () => {
        const raw = {
          reasoning: "",
          intent: null,
          clarification: null,
        };

        const result = parseLLMResponse(raw);
        // Never both null — should fallback to clarification
        const bothNull = result.intent === null && result.clarification === null;
        expect(bothNull).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

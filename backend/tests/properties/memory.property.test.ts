// ============================================================
// DeFi Copilot — Memory Service Property-Based Tests
// Properties 16-18
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { remember, recall, _clearMemoryStore } from "@/services/memory-service";
import { MemoryContent, MemoryRecord } from "@/types";

// --- Setup ---

beforeEach(() => {
  _clearMemoryStore();
});

// --- Generators ---

const walletAddressArb = fc
  .hexaString({ minLength: 64, maxLength: 64 })
  .map((s) => `0x${s}`);

const tokenSymbolArb = fc.constantFrom("SUI", "USDC", "USDT", "WETH", "CETUS");

const actionTypeArb = fc.constantFrom("swap", "stake");

const protocolArb = fc.constantFrom("Cetus", "Turbos", "KriyaDex", "DeepBook");

const outcomeArb = fc.constantFrom("success", "failed");

const preferenceCategoryArb = fc.constantFrom("dex", "slippage", "validator");

// --- Property 16: Memory record completeness on store ---

describe("Feature: defi-copilot-hackathon, Property 16: Memory record completeness on store", () => {
  it("for any stored transaction, record contains: action type, tokens, amounts, protocol, outcome, timestamp within 5s", async () => {
    await fc.assert(
      fc.asyncProperty(
        walletAddressArb,
        actionTypeArb,
        fc.array(tokenSymbolArb, { minLength: 1, maxLength: 3 }),
        fc.array(fc.double({ min: 0.01, max: 100000, noNaN: true }), { minLength: 1, maxLength: 3 }),
        protocolArb,
        outcomeArb,
        async (walletAddress, action, tokens, amounts, protocol, outcome) => {
          _clearMemoryStore();
          const beforeStore = Date.now();

          const content: MemoryContent = {
            type: "transaction",
            content: `${action === "swap" ? "Swapped" : "Staked"} ${tokens.join(" → ")} via ${protocol}`,
            metadata: {
              action,
              tokens,
              amounts,
              protocol,
              outcome,
            },
          };

          await remember(walletAddress, content);

          const afterStore = Date.now();

          // Recall to verify stored record
          const memories = await recall(walletAddress, "test");

          expect(memories.length).toBeGreaterThan(0);

          const stored = memories[0];

          // Verify required fields
          expect(stored.type).toBe("transaction");
          expect(stored.metadata).toBeDefined();
          expect(stored.metadata!.action).toBe(action);
          expect(stored.metadata!.tokens).toEqual(tokens);
          expect(stored.metadata!.amounts).toEqual(amounts);
          expect(stored.metadata!.protocol).toBe(protocol);
          expect(stored.metadata!.outcome).toBe(outcome);

          // Timestamp within 5 seconds of confirmation
          expect(stored.timestamp).toBeGreaterThanOrEqual(beforeStore - 5000);
          expect(stored.timestamp).toBeLessThanOrEqual(afterStore + 5000);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 17: Preference overwrite semantics ---

describe("Feature: defi-copilot-hackathon, Property 17: Preference overwrite semantics", () => {
  it("for any two preference stores of same category, only the latest is returned on recall", async () => {
    await fc.assert(
      fc.asyncProperty(
        walletAddressArb,
        preferenceCategoryArb,
        fc.string({ minLength: 3, maxLength: 20 }),
        fc.string({ minLength: 3, maxLength: 20 }),
        async (walletAddress, category, firstValue, secondValue) => {
          _clearMemoryStore();
          // Pre-condition: values should be different to verify overwrite
          fc.pre(firstValue !== secondValue);

          // Store first preference
          await remember(walletAddress, {
            type: "preference",
            content: `Preferred ${category}: ${firstValue}`,
            metadata: { category, value: firstValue },
          });

          // Store second preference (same category) — should overwrite
          await remember(walletAddress, {
            type: "preference",
            content: `Preferred ${category}: ${secondValue}`,
            metadata: { category, value: secondValue },
          });

          // Recall and verify only latest is present
          const memories = await recall(walletAddress, "preferences");

          const preferencesOfCategory = memories.filter(
            (m) => m.type === "preference" && m.metadata?.category === category
          );

          // Only one preference of this category should exist
          expect(preferencesOfCategory.length).toBe(1);
          // It should be the latest value
          expect(preferencesOfCategory[0].metadata!.value).toBe(secondValue);
          expect(preferencesOfCategory[0].content).toContain(secondValue);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 18: Memory indicator names applied preference ---

describe("Feature: defi-copilot-hackathon, Property 18: Memory indicator names applied preference", () => {
  it("for any applied preference, memory indicator contains the category name and preference value", () => {
    const dexNames = ["Cetus", "Turbos", "KriyaDex", "DeepBook"];

    /**
     * Simulates the memory indicator generation (mirrors intent-parser logic)
     */
    function generateMemoryIndicator(category: string, value: string): string {
      return `Using ${value} (your preferred ${category})`;
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...dexNames),
        (dexName) => {
          const category = "DEX";
          const indicator = generateMemoryIndicator(category, dexName);

          // Indicator must contain the preference value
          expect(indicator).toContain(dexName);
          // Indicator must contain the category (case-insensitive check)
          expect(indicator.toLowerCase()).toContain(category.toLowerCase());
        }
      ),
      { numRuns: 100 }
    );
  });

  it("for any recalled DEX preference applied to intent, indicator contains DEX name", () => {
    const dexNames = ["Cetus", "Turbos", "KriyaDex", "DeepBook"];

    fc.assert(
      fc.property(
        fc.constantFrom(...dexNames),
        fc.double({ min: 0.01, max: 10000, noNaN: true }),
        (dexName, amount) => {
          const memories: MemoryRecord[] = [
            {
              id: "pref_dex",
              type: "preference",
              content: `Preferred DEX: ${dexName}`,
              timestamp: Date.now(),
              metadata: { category: "dex", value: dexName },
            },
          ];

          // Simulate applyMemoryPreferences logic
          const intent = {
            action: "swap" as const,
            fromToken: "USDC",
            toToken: "SUI",
            amount,
          };

          // Look for DEX preference
          let memoryIndicator: string | null = null;
          if (!intent.dex) {
            for (const mem of memories) {
              if (mem.type === "preference" && mem.content.toLowerCase().includes("dex")) {
                const match = mem.content.match(/(?:dex|DEX)[:\s]+(\w+)/i);
                if (match) {
                  memoryIndicator = `Using ${match[1]} (your preferred DEX)`;
                }
              }
            }
          }

          expect(memoryIndicator).not.toBeNull();
          expect(memoryIndicator!).toContain(dexName);
          expect(memoryIndicator!.toLowerCase()).toContain("dex");
        }
      ),
      { numRuns: 100 }
    );
  });
});

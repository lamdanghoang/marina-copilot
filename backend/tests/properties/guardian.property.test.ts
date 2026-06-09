// ============================================================
// Marina Copilot — Guardian Property-Based Tests
// Properties 8-12, 22
// ============================================================

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { assessRisks } from "@/services/guardian";
import {
  GuardianInput,
  SwapIntent,
  StakeIntent,
  PortfolioBalance,
  TransactionMetadata,
  MemoryRecord,
} from "@/types";

// --- Generators ---

const swapIntentArb = (overrides?: Partial<SwapIntent>): fc.Arbitrary<SwapIntent> =>
  fc.record({
    action: fc.constant("swap" as const),
    fromToken: fc.constantFrom("USDC", "USDT", "WETH", "CETUS"),
    toToken: fc.constantFrom("SUI", "USDC", "USDT", "WETH"),
    amount: fc.double({ min: 0.01, max: 100000, noNaN: true }),
  }).map((r) => ({ ...r, ...overrides }));

const stakeIntentArb = (overrides?: Partial<StakeIntent>): fc.Arbitrary<StakeIntent> =>
  fc.record({
    action: fc.constant("stake" as const),
    token: fc.constant("SUI" as const),
    amount: fc.double({ min: 1, max: 100000, noNaN: true }),
  }).map((r) => ({ ...r, ...overrides }));

const portfolioBalanceArb: fc.Arbitrary<PortfolioBalance> = fc.record({
  token: fc.constantFrom("SUI", "USDC", "USDT", "WETH", "CETUS"),
  balance: fc.double({ min: 0.01, max: 100000, noNaN: true }),
  valueUsd: fc.double({ min: 0.01, max: 1000000, noNaN: true }),
});

const diversifiedPortfolioArb: fc.Arbitrary<PortfolioBalance[]> = fc
  .tuple(
    fc.record({
      token: fc.constant("SUI"),
      balance: fc.double({ min: 10, max: 1000, noNaN: true }),
      valueUsd: fc.double({ min: 100, max: 3000, noNaN: true }),
    }),
    fc.record({
      token: fc.constant("USDC"),
      balance: fc.double({ min: 10, max: 1000, noNaN: true }),
      valueUsd: fc.double({ min: 100, max: 3000, noNaN: true }),
    }),
    fc.record({
      token: fc.constant("WETH"),
      balance: fc.double({ min: 0.01, max: 10, noNaN: true }),
      valueUsd: fc.double({ min: 100, max: 3000, noNaN: true }),
    })
  )
  .map(([sui, usdc, weth]) => [sui, usdc, weth]);

// --- Property 8: Guardian slippage detection with data ---

describe("Feature: marina-copilot-hackathon, Property 8: Guardian slippage detection with data", () => {
  it("for any swap with priceImpact > 1%, Guardian produces slippage warning with impact percentage and estimated loss", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.01, max: 50, noNaN: true }),
        fc.double({ min: 1, max: 10000, noNaN: true }),
        swapIntentArb(),
        diversifiedPortfolioArb,
        (priceImpact, estimatedOutput, intent, portfolio) => {
          const metadata: TransactionMetadata = {
            type: "swap",
            steps: [{ index: 1, description: "Swap", type: "swap" }],
            gasEstimate: 0.005,
            route: [intent.fromToken, intent.toToken],
            exchangeRate: estimatedOutput / intent.amount,
            estimatedOutput,
            minimumOutput: estimatedOutput * 0.99,
            priceImpact,
          };

          const input: GuardianInput = { intent, metadata, portfolio };
          const result = assessRisks(input);

          const slippageRisk = result.risks.find((r) => r.class === "HIGH_SLIPPAGE");
          expect(slippageRisk).toBeDefined();
          expect(slippageRisk!.data.priceImpact).toBe(priceImpact);
          expect(slippageRisk!.data.estimatedLoss).toBeDefined();
          expect(typeof slippageRisk!.data.estimatedLoss).toBe("number");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 9: Guardian concentration detection with data ---

describe("Feature: marina-copilot-hackathon, Property 9: Guardian concentration detection with data", () => {
  it("for any transaction where resulting single-asset > 70%, Guardian produces concentration warning with percentage", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 10000, noNaN: true }),
        fc.double({ min: 0.1, max: 50, noNaN: true }),
        (dominantValueUsd, otherValueUsd) => {
          // Ensure the dominant asset is > 70% of total
          const totalValue = dominantValueUsd + otherValueUsd;
          const percentage = (dominantValueUsd / totalValue) * 100;
          fc.pre(percentage > 70);

          const portfolio: PortfolioBalance[] = [
            { token: "SUI", balance: dominantValueUsd / 4, valueUsd: dominantValueUsd },
            { token: "USDC", balance: otherValueUsd, valueUsd: otherValueUsd },
          ];

          // Stake doesn't change portfolio composition, so use a swap that
          // preserves the existing concentration
          const intent: SwapIntent = {
            action: "swap",
            fromToken: "USDC",
            toToken: "SUI",
            amount: 0.01, // Tiny swap to preserve existing concentration
          };

          const metadata: TransactionMetadata = {
            type: "swap",
            steps: [{ index: 1, description: "Swap", type: "swap" }],
            gasEstimate: 0.005,
            route: ["USDC", "SUI"],
            exchangeRate: 0.25,
            estimatedOutput: 0.0025,
            minimumOutput: 0.002475,
            priceImpact: 0.1,
          };

          const input: GuardianInput = { intent, metadata, portfolio };
          const result = assessRisks(input);

          const concentrationRisk = result.risks.find((r) => r.class === "CONCENTRATION");
          expect(concentrationRisk).toBeDefined();
          expect(concentrationRisk!.data.resultingPercentage).toBeDefined();
          expect(concentrationRisk!.data.resultingPercentage!).toBeGreaterThan(70);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 10: All risk warnings contain explanation and suggestion ---

describe("Feature: marina-copilot-hackathon, Property 10: All risk warnings contain explanation and suggestion", () => {
  it("for any Guardian output with risks, every risk has non-empty explanation AND suggestion", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.01, max: 50, noNaN: true }),
        fc.double({ min: 1, max: 10000, noNaN: true }),
        (priceImpact, estimatedOutput) => {
          const intent: SwapIntent = {
            action: "swap",
            fromToken: "USDC",
            toToken: "SUI",
            amount: 100,
          };

          const metadata: TransactionMetadata = {
            type: "swap",
            steps: [{ index: 1, description: "Swap", type: "swap" }],
            gasEstimate: 0.005,
            route: ["USDC", "SUI"],
            exchangeRate: estimatedOutput / 100,
            estimatedOutput,
            minimumOutput: estimatedOutput * 0.99,
            priceImpact,
          };

          const portfolio: PortfolioBalance[] = [
            { token: "SUI", balance: 100, valueUsd: 400 },
            { token: "USDC", balance: 500, valueUsd: 500 },
          ];

          const input: GuardianInput = { intent, metadata, portfolio };
          const result = assessRisks(input);

          // We expect at least one risk (slippage since priceImpact > 1%)
          expect(result.risks.length).toBeGreaterThan(0);

          for (const risk of result.risks) {
            expect(risk.explanation).toBeDefined();
            expect(risk.explanation.trim().length).toBeGreaterThan(0);
            expect(risk.suggestion).toBeDefined();
            expect(risk.suggestion.trim().length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 11: No risks detected implies safe assessment ---

describe("Feature: marina-copilot-hackathon, Property 11: No risks detected implies safe assessment", () => {
  it("for any swap with priceImpact ≤ 1% AND concentration ≤ 70%, assessment = safe with empty risks", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1.0, noNaN: true }),
        fc.double({ min: 0.01, max: 50, noNaN: true }),
        (priceImpact, swapAmount) => {
          // Build a well-diversified portfolio where no asset exceeds 70% after swap
          const intent: SwapIntent = {
            action: "swap",
            fromToken: "USDC",
            toToken: "SUI",
            amount: swapAmount,
          };

          const estimatedOutput = swapAmount * 0.25;

          const metadata: TransactionMetadata = {
            type: "swap",
            steps: [{ index: 1, description: "Swap", type: "swap" }],
            gasEstimate: 0.005,
            route: ["USDC", "SUI"],
            exchangeRate: 0.25,
            estimatedOutput,
            minimumOutput: estimatedOutput * 0.99,
            priceImpact,
          };

          // Diversified: each asset is roughly 33%
          // Ensure swap amount is small enough to not create concentration
          const portfolio: PortfolioBalance[] = [
            { token: "SUI", balance: 250, valueUsd: 1000 },
            { token: "USDC", balance: 1000, valueUsd: 1000 },
            { token: "WETH", balance: 0.3, valueUsd: 1000 },
          ];

          // Pre-condition: the swap must not create concentration > 70%
          // After swap: USDC decreases by swapAmount USD, SUI increases by ~same
          // SUI new value ≈ 1000 + swapAmount, USDC new value ≈ 1000 - swapAmount
          // Total ≈ 3000, max asset ≈ 1000 + swapAmount
          // For no concentration: (1000 + swapAmount) / 3000 <= 0.70
          // swapAmount <= 1100
          fc.pre(swapAmount <= 1000 * 0.7); // Ensure it stays under 70%

          const input: GuardianInput = { intent, metadata, portfolio };
          const result = assessRisks(input);

          expect(result.assessment).toBe("safe");
          expect(result.risks).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 12: Non-swap transactions skip slippage check ---

describe("Feature: marina-copilot-hackathon, Property 12: Non-swap transactions skip slippage check", () => {
  it("for any stake transaction, Guardian never produces HIGH_SLIPPAGE warning", () => {
    fc.assert(
      fc.property(
        stakeIntentArb(),
        fc.double({ min: 0, max: 50, noNaN: true }),
        diversifiedPortfolioArb,
        (intent, priceImpact, portfolio) => {
          const metadata: TransactionMetadata = {
            type: "stake",
            steps: [{ index: 1, description: "Stake SUI", type: "stake" }],
            gasEstimate: 0.005,
            validatorName: "Test Validator",
            estimatedApy: 4.5,
            priceImpact, // Even if this were somehow set
          };

          const input: GuardianInput = { intent, metadata, portfolio };
          const result = assessRisks(input);

          const slippageRisk = result.risks.find((r) => r.class === "HIGH_SLIPPAGE");
          expect(slippageRisk).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 22: Cumulative concentration considers transaction history ---

describe("Feature: marina-copilot-hackathon, Property 22: Cumulative concentration considers transaction history", () => {
  it("for any combination of portfolio + pending tx + 30-day history, cumulative concentration correctly flags when > 70%", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 5000, noNaN: true }),
        fc.double({ min: 100, max: 5000, noNaN: true }),
        fc.array(
          fc.double({ min: 50, max: 2000, noNaN: true }),
          { minLength: 1, maxLength: 5 }
        ),
        (suiValueUsd, otherValueUsd, historicalAmounts) => {
          const now = Date.now();

          // Build transaction history where user has been accumulating SUI
          const memories: MemoryRecord[] = historicalAmounts.map((amount, i) => ({
            id: `tx_${i}`,
            type: "transaction" as const,
            content: `Swapped ${amount} USDC to SUI via Cetus`,
            timestamp: now - (i + 1) * 3 * 24 * 60 * 60 * 1000, // Within 30 days
            metadata: {
              action: "swap",
              tokens: ["USDC", "SUI"],
              amounts: [amount],
              outcome: "success",
            },
          }));

          const totalHistorical = historicalAmounts.reduce((sum, a) => sum + a, 0);
          const totalPortfolio = suiValueUsd + otherValueUsd;

          // Calculate cumulative concentration
          // (suiValueUsd + totalHistorical) / (totalPortfolio + totalHistorical)
          const cumulativePercentage =
            ((suiValueUsd + totalHistorical) / (totalPortfolio + totalHistorical)) * 100;

          // Only test cases where cumulative > 70% to verify it flags
          fc.pre(cumulativePercentage > 70);

          const portfolio: PortfolioBalance[] = [
            { token: "SUI", balance: suiValueUsd / 4, valueUsd: suiValueUsd },
            { token: "USDC", balance: otherValueUsd, valueUsd: otherValueUsd },
          ];

          const intent: SwapIntent = {
            action: "swap",
            fromToken: "USDC",
            toToken: "SUI",
            amount: 1, // Small swap
          };

          const metadata: TransactionMetadata = {
            type: "swap",
            steps: [{ index: 1, description: "Swap", type: "swap" }],
            gasEstimate: 0.005,
            route: ["USDC", "SUI"],
            exchangeRate: 0.25,
            estimatedOutput: 0.25,
            minimumOutput: 0.2475,
            priceImpact: 0.1,
          };

          const input: GuardianInput = { intent, metadata, portfolio, memories };
          const result = assessRisks(input);

          const concentrationRisk = result.risks.find((r) => r.class === "CONCENTRATION");
          expect(concentrationRisk).toBeDefined();
          expect(concentrationRisk!.data.resultingPercentage!).toBeGreaterThan(70);
        }
      ),
      { numRuns: 100 }
    );
  });
});

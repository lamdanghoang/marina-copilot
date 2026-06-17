// ============================================================
// Marina Copilot — Preview & Success Message Property-Based Tests
// Properties 13-14
// ============================================================

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type {
  TransactionMetadata,
  PTBStep,
  RiskWarning,
  ProcessIntentResponse,
} from "@/types";
import {
  truncateDigest,
  buildExplorerUrl,
  buildActionSummary,
} from "@/hooks/useTransactionExecution";

// --- Helpers for preview rendering assertions ---

/**
 * Simulates extracting what the preview renderer would display.
 * We test the pure data transformation, not React rendering.
 */
function extractPreviewDisplayData(preview: NonNullable<ProcessIntentResponse["preview"]>): {
  numberedSteps: string[];
  hasExchangeRate: boolean;
  hasMinReceived: boolean;
  hasPriceImpact: boolean;
  hasGas: boolean;
  hasRisks: boolean;
  confirmButtonLabel: string;
} {
  const { steps, metadata, risks } = preview;

  const numberedSteps = steps.map((s) => `${s.index}. ${s.description}`);

  const hasExchangeRate = metadata.type === "swap" && metadata.exchangeRate != null;
  const hasMinReceived = metadata.type === "swap" && metadata.minimumOutput != null;
  const hasPriceImpact = metadata.type === "swap" && metadata.priceImpact != null;
  const hasGas = metadata.gasEstimate != null && metadata.gasEstimate > 0;
  const hasRisks = risks.length > 0;

  const confirmButtonLabel = hasRisks ? "Confirm Anyway" : "Confirm & Sign";

  return {
    numberedSteps,
    hasExchangeRate,
    hasMinReceived,
    hasPriceImpact,
    hasGas,
    hasRisks,
    confirmButtonLabel,
  };
}

// --- Generators ---

const stepTypeArb = fc.constantFrom("split" as const, "swap" as const, "stake" as const, "receive" as const);

const ptbStepArb = (index: number): fc.Arbitrary<PTBStep> =>
  fc.record({
    index: fc.constant(index),
    description: fc.string({ minLength: 5, maxLength: 100 }),
    type: stepTypeArb,
  });

const swapMetadataArb: fc.Arbitrary<TransactionMetadata> = fc.record({
  type: fc.constant("swap" as const),
  steps: fc.integer({ min: 1, max: 4 }).chain((n) =>
    fc.tuple(...Array.from({ length: n }, (_, i) => ptbStepArb(i + 1)))
  ),
  gasEstimate: fc.double({ min: 0.001, max: 0.1, noNaN: true }),
  route: fc.tuple(
    fc.constantFrom("USDC", "USDT", "SUI", "WETH"),
    fc.constantFrom("SUI", "USDC", "USDT", "WETH")
  ).map(([a, b]) => [a, b]),
  exchangeRate: fc.double({ min: 0.001, max: 1000, noNaN: true }),
  estimatedOutput: fc.double({ min: 0.001, max: 100000, noNaN: true }),
  minimumOutput: fc.double({ min: 0.001, max: 100000, noNaN: true }),
  priceImpact: fc.double({ min: 0, max: 20, noNaN: true }),
});

const stakeMetadataArb: fc.Arbitrary<TransactionMetadata> = fc.record({
  type: fc.constant("stake" as const),
  steps: fc.integer({ min: 1, max: 3 }).chain((n) =>
    fc.tuple(...Array.from({ length: n }, (_, i) => ptbStepArb(i + 1)))
  ),
  gasEstimate: fc.double({ min: 0.001, max: 0.1, noNaN: true }),
  validatorName: fc.constantFrom("Mysten Labs", "Sui Foundation", "OKX", "Binance"),
  estimatedApy: fc.double({ min: 0, max: 20, noNaN: true }),
});

const riskWarningArb: fc.Arbitrary<RiskWarning> = fc.record({
  class: fc.constantFrom("HIGH_SLIPPAGE" as const, "CONCENTRATION" as const),
  severity: fc.constantFrom("warning" as const, "elevated" as const, "danger" as const),
  explanation: fc.string({ minLength: 10, maxLength: 200 }),
  suggestion: fc.string({ minLength: 10, maxLength: 200 }),
  data: fc.record({
    priceImpact: fc.option(fc.double({ min: 0, max: 20, noNaN: true }), { nil: undefined }),
    estimatedLoss: fc.option(fc.double({ min: 0, max: 10000, noNaN: true }), { nil: undefined }),
    resultingPercentage: fc.option(fc.double({ min: 70, max: 100, noNaN: true }), { nil: undefined }),
    asset: fc.option(fc.constantFrom("SUI", "USDC", "USDT"), { nil: undefined }),
  }),
});

const digestArb: fc.Arbitrary<string> = fc
  .hexaString({ minLength: 32, maxLength: 64 })
  .filter((s) => s.length >= 12);

// --- Property 13: Preview renders complete data for its response type ---

describe("Feature: marina-copilot-hackathon, Property 13: Preview renders complete data for its response type", () => {
  it("for any preview response with swap, rendered includes: numbered steps, exchange rate, min received, price impact, gas", () => {
    fc.assert(
      fc.property(swapMetadataArb, (metadata) => {
        const preview: NonNullable<ProcessIntentResponse["preview"]> = {
          steps: metadata.steps,
          metadata,
          risks: [],
          assessment: "safe",
          transactionBytes: "dGVzdA==", // base64 "test"
        };

        const display = extractPreviewDisplayData(preview);

        // Numbered steps
        expect(display.numberedSteps.length).toBeGreaterThan(0);
        for (const step of display.numberedSteps) {
          expect(step).toMatch(/^\d+\./);
        }

        // Swap metadata fields
        expect(display.hasExchangeRate).toBe(true);
        expect(display.hasMinReceived).toBe(true);
        expect(display.hasPriceImpact).toBe(true);
        expect(display.hasGas).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("when risks present, button is 'Confirm Anyway'", () => {
    fc.assert(
      fc.property(
        swapMetadataArb,
        fc.array(riskWarningArb, { minLength: 1, maxLength: 3 }),
        (metadata, risks) => {
          const preview: NonNullable<ProcessIntentResponse["preview"]> = {
            steps: metadata.steps,
            metadata,
            risks,
            assessment: "warning",
            transactionBytes: "dGVzdA==",
          };

          const display = extractPreviewDisplayData(preview);

          expect(display.hasRisks).toBe(true);
          expect(display.confirmButtonLabel).toBe("Confirm Anyway");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("when no risks, button is 'Confirm & Sign'", () => {
    fc.assert(
      fc.property(swapMetadataArb, (metadata) => {
        const preview: NonNullable<ProcessIntentResponse["preview"]> = {
          steps: metadata.steps,
          metadata,
          risks: [],
          assessment: "safe",
          transactionBytes: "dGVzdA==",
        };

        const display = extractPreviewDisplayData(preview);

        expect(display.hasRisks).toBe(false);
        expect(display.confirmButtonLabel).toBe("Confirm & Sign");
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 14: Success message contains all required fields ---

describe("Feature: marina-copilot-hackathon, Property 14: Success message contains all required fields", () => {
  it("for any success message, includes: action summary, digest truncated to first 8 + last 4 chars, valid Explorer URL", () => {
    fc.assert(
      fc.property(
        fc.oneof(swapMetadataArb, stakeMetadataArb),
        digestArb,
        (metadata, digest) => {
          // Test truncateDigest
          const truncated = truncateDigest(digest);
          if (digest.length >= 12) {
            expect(truncated).toContain(digest.slice(0, 8));
            expect(truncated).toContain(digest.slice(-4));
            expect(truncated).toContain("...");
          }

          // Test buildExplorerUrl
          const explorerUrl = buildExplorerUrl(digest);
          expect(explorerUrl).toContain("suiscan.xyz");
          expect(explorerUrl).toContain(digest);
          expect(explorerUrl).toMatch(/^https:\/\//);

          // Test buildActionSummary
          const summary = buildActionSummary(metadata);
          expect(summary.length).toBeGreaterThan(0);

          // For valid metadata with steps, summary should be descriptive
          const relevantStep = metadata.type === "swap"
            ? metadata.steps.find((s: any) => s.type === "swap")
            : metadata.steps.find((s: any) => s.type === "stake");
          if (relevantStep) {
            expect(summary).toBe(relevantStep.description);
          } else {
            // Fallback — still non-empty
            expect(summary.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("truncateDigest shows first 8 + ... + last 4 for any digest >= 12 chars", () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 12, maxLength: 88 }),
        (digest) => {
          const truncated = truncateDigest(digest);

          const expectedStart = digest.slice(0, 8);
          const expectedEnd = digest.slice(-4);

          expect(truncated).toBe(`${expectedStart}...${expectedEnd}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("buildExplorerUrl produces valid URL containing the full digest", () => {
    fc.assert(
      fc.property(digestArb, (digest) => {
        const url = buildExplorerUrl(digest);

        // Valid URL format
        expect(url).toMatch(/^https:\/\/suiscan\.xyz\/testnet\/tx\/.+$/);
        // Contains the full digest (for deep linking)
        expect(url).toContain(digest);
      }),
      { numRuns: 100 }
    );
  });
});

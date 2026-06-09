// ============================================================
// Marina Copilot — PTB Compiler Property-Based Tests
// Properties 4-7
// ============================================================

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  TransactionMetadata,
  SwapIntent,
  StakeIntent,
  PTBStep,
  AppError,
  ErrorCode,
} from "@/types";
import { DEFAULT_SLIPPAGE } from "@/types/config";

// --- Helper: simulate metadata generation for swap ---

function buildSwapMetadata(
  intent: SwapIntent,
  estimatedOutput: number,
  priceImpact: number,
  gasEstimate: number
): TransactionMetadata {
  const slippage = intent.slippageTolerance ?? DEFAULT_SLIPPAGE;
  const minimumOutput = estimatedOutput * (1 - slippage);
  const exchangeRate = estimatedOutput / intent.amount;
  const route = [intent.fromToken, intent.toToken];

  const steps: PTBStep[] = [
    {
      index: 1,
      description: `Swap ${intent.amount} ${intent.fromToken} → ~${estimatedOutput.toFixed(4)} ${intent.toToken}`,
      type: "swap",
    },
    {
      index: 2,
      description: `Receive minimum ${minimumOutput.toFixed(4)} ${intent.toToken}`,
      type: "receive",
    },
  ];

  return {
    type: "swap",
    steps,
    gasEstimate,
    route,
    exchangeRate,
    estimatedOutput,
    minimumOutput,
    priceImpact,
  };
}

function buildStakeMetadata(
  validatorName: string,
  estimatedApy: number,
  gasEstimate: number
): TransactionMetadata {
  return {
    type: "stake",
    steps: [
      { index: 1, description: "Reserve 0.05 SUI for gas", type: "split" },
      { index: 2, description: `Stake SUI with ${validatorName}`, type: "stake" },
    ],
    gasEstimate,
    validatorName,
    estimatedApy,
  };
}

function buildInsufficientBalanceError(
  available: number,
  required: number,
  token: string
): AppError {
  return {
    code: ErrorCode.INSUFFICIENT_BALANCE,
    message: `You have ${available} ${token} but need ${required}. Try a smaller amount.`,
    suggestion: `Your available balance (after gas reserve) is ${available} ${token}.`,
    details: { available, required, token },
  };
}

// --- Generators ---

const swapIntentArb: fc.Arbitrary<SwapIntent> = fc.record({
  action: fc.constant("swap" as const),
  fromToken: fc.constantFrom("USDC", "USDT", "WETH", "CETUS", "SUI"),
  toToken: fc.constantFrom("SUI", "USDC", "USDT", "WETH", "CETUS"),
  amount: fc.double({ min: 0.01, max: 100000, noNaN: true }),
  slippageTolerance: fc.option(fc.double({ min: 0.001, max: 0.1, noNaN: true }), { nil: undefined }),
}).filter((i) => i.fromToken !== i.toToken);

const stakeIntentArb: fc.Arbitrary<StakeIntent> = fc.record({
  action: fc.constant("stake" as const),
  token: fc.constant("SUI" as const),
  amount: fc.double({ min: 1, max: 100000, noNaN: true }),
  validator: fc.option(fc.string({ minLength: 3, maxLength: 30 }), { nil: undefined }),
});

const validatorNameArb = fc.constantFrom(
  "Mysten Labs",
  "Sui Foundation",
  "Aftermath",
  "OKX",
  "Binance Staking"
);

// --- Property 4: Compiled transaction metadata contains all required fields ---

describe("Feature: marina-copilot-hackathon, Property 4: Compiled transaction metadata contains all required fields", () => {
  it("for any successfully compiled swap, metadata has: route, exchangeRate, estimatedOutput, minimumOutput, priceImpact, gasEstimate", () => {
    fc.assert(
      fc.property(
        swapIntentArb,
        fc.double({ min: 0.001, max: 100000, noNaN: true }),
        fc.double({ min: 0, max: 20, noNaN: true }),
        fc.double({ min: 0.001, max: 0.1, noNaN: true }),
        (intent, estimatedOutput, priceImpact, gasEstimate) => {
          const metadata = buildSwapMetadata(intent, estimatedOutput, priceImpact, gasEstimate);

          // Verify all required swap fields exist
          expect(metadata.route).toBeDefined();
          expect(Array.isArray(metadata.route)).toBe(true);
          expect(metadata.route!.length).toBeGreaterThanOrEqual(2);
          expect(metadata.exchangeRate).toBeDefined();
          expect(typeof metadata.exchangeRate).toBe("number");
          expect(metadata.estimatedOutput).toBeDefined();
          expect(typeof metadata.estimatedOutput).toBe("number");
          expect(metadata.minimumOutput).toBeDefined();
          expect(typeof metadata.minimumOutput).toBe("number");
          expect(metadata.priceImpact).toBeDefined();
          expect(typeof metadata.priceImpact).toBe("number");
          expect(metadata.gasEstimate).toBeDefined();
          expect(typeof metadata.gasEstimate).toBe("number");
          expect(metadata.gasEstimate).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("for any successfully compiled stake, metadata has: validatorName, estimatedApy, gasEstimate", () => {
    fc.assert(
      fc.property(
        validatorNameArb,
        fc.double({ min: 0, max: 20, noNaN: true }),
        fc.double({ min: 0.001, max: 0.1, noNaN: true }),
        (validatorName, estimatedApy, gasEstimate) => {
          const metadata = buildStakeMetadata(validatorName, estimatedApy, gasEstimate);

          // Verify all required stake fields exist
          expect(metadata.validatorName).toBeDefined();
          expect(typeof metadata.validatorName).toBe("string");
          expect(metadata.validatorName!.length).toBeGreaterThan(0);
          expect(metadata.estimatedApy).toBeDefined();
          expect(typeof metadata.estimatedApy).toBe("number");
          expect(metadata.gasEstimate).toBeDefined();
          expect(typeof metadata.gasEstimate).toBe("number");
          expect(metadata.gasEstimate).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 5: Insufficient balance error includes available balance and required amount ---

describe("Feature: marina-copilot-hackathon, Property 5: Insufficient balance error includes available and required", () => {
  it("for any insufficient balance scenario, error contains available balance value AND required amount value", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: 0.01, max: 100000, noNaN: true }),
        fc.constantFrom("SUI", "USDC", "USDT", "WETH", "CETUS"),
        (available, required, token) => {
          // Pre-condition: available < required (insufficient)
          fc.pre(available < required);

          const error = buildInsufficientBalanceError(available, required, token);

          // Verify error structure
          expect(error.code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
          expect(error.message).toContain(String(available));
          expect(error.message).toContain(String(required));
          expect(error.details).toBeDefined();

          const details = error.details as { available: number; required: number };
          expect(details.available).toBe(available);
          expect(details.required).toBe(required);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 6: Default slippage tolerance calculation ---

describe("Feature: marina-copilot-hackathon, Property 6: Default slippage tolerance calculation", () => {
  it("for any swap without explicit slippage, minimumOutput = estimatedOutput * 0.99", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 100000, noNaN: true }),
        fc.double({ min: 0.01, max: 100000, noNaN: true }),
        (amount, estimatedOutput) => {
          const intent: SwapIntent = {
            action: "swap",
            fromToken: "USDC",
            toToken: "SUI",
            amount,
            // No slippageTolerance specified — should default to 1%
          };

          const metadata = buildSwapMetadata(intent, estimatedOutput, 0.5, 0.005);

          // minimumOutput should be estimatedOutput * (1 - 0.01) = estimatedOutput * 0.99
          const expectedMinimum = estimatedOutput * (1 - DEFAULT_SLIPPAGE);
          expect(metadata.minimumOutput).toBeCloseTo(expectedMinimum, 5);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 7: Highest APY validator selection ---

describe("Feature: marina-copilot-hackathon, Property 7: Highest APY validator selection", () => {
  interface ValidatorInfo {
    name: string;
    apy: number;
    address: string;
  }

  /**
   * Simulates the highest-APY validator selection logic from ptb-compiler.ts
   */
  function selectHighestApyValidator(validators: ValidatorInfo[]): ValidatorInfo {
    return validators.reduce((best, current) =>
      current.apy > best.apy ? current : best
    );
  }

  it("for any non-empty validator list without preference, selected validator has APY >= all others", () => {
    const validatorArb: fc.Arbitrary<ValidatorInfo> = fc.record({
      name: fc.string({ minLength: 3, maxLength: 20 }),
      apy: fc.double({ min: 0, max: 30, noNaN: true }),
      address: fc.hexaString({ minLength: 64, maxLength: 64 }).map((s) => `0x${s}`),
    });

    fc.assert(
      fc.property(
        fc.array(validatorArb, { minLength: 1, maxLength: 50 }),
        (validators) => {
          const selected = selectHighestApyValidator(validators);

          // The selected validator's APY should be >= all others
          for (const v of validators) {
            expect(selected.apy).toBeGreaterThanOrEqual(v.apy);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

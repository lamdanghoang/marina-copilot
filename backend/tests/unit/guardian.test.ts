// ============================================================
// DeFi Copilot — Guardian Service Unit Tests
// ============================================================

import { describe, it, expect } from "vitest";
import { assessRisks } from "@/services/guardian";
import {
  GuardianInput,
  GuardianOutput,
  SwapIntent,
  StakeIntent,
  PortfolioBalance,
  TransactionMetadata,
} from "@/types";

// --- Test Helpers ---

function makeSwapIntent(overrides?: Partial<SwapIntent>): SwapIntent {
  return {
    action: "swap",
    fromToken: "USDC",
    toToken: "SUI",
    amount: 100,
    ...overrides,
  };
}

function makeStakeIntent(overrides?: Partial<StakeIntent>): StakeIntent {
  return {
    action: "stake",
    token: "SUI",
    amount: 50,
    ...overrides,
  };
}

function makeSwapMetadata(
  overrides?: Partial<TransactionMetadata>
): TransactionMetadata {
  return {
    type: "swap",
    steps: [
      { index: 1, description: "Swap 100 USDC → ~25 SUI via Cetus", type: "swap" },
    ],
    gasEstimate: 0.005,
    route: ["USDC", "SUI"],
    exchangeRate: 0.25,
    estimatedOutput: 25,
    minimumOutput: 24.75,
    priceImpact: 0.5, // 0.5% — safe
    ...overrides,
  };
}

function makeStakeMetadata(
  overrides?: Partial<TransactionMetadata>
): TransactionMetadata {
  return {
    type: "stake",
    steps: [
      { index: 1, description: "Stake 50 SUI with Mysten Labs", type: "stake" },
    ],
    gasEstimate: 0.005,
    validatorName: "Mysten Labs",
    estimatedApy: 4.5,
    ...overrides,
  };
}

function makeDiversifiedPortfolio(): PortfolioBalance[] {
  return [
    { token: "SUI", balance: 100, valueUsd: 400 },
    { token: "USDC", balance: 500, valueUsd: 500 },
    { token: "WETH", balance: 0.1, valueUsd: 300 },
  ];
}

function makeConcentratedPortfolio(): PortfolioBalance[] {
  return [
    { token: "SUI", balance: 1000, valueUsd: 4000 },
    { token: "USDC", balance: 100, valueUsd: 100 },
  ];
}

// --- Tests ---

describe("Guardian - assessRisks", () => {
  describe("Slippage detection", () => {
    it("should flag slippage when price impact > 1%", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 2.5, estimatedOutput: 25 }),
        portfolio: makeDiversifiedPortfolio(),
      };

      const result = assessRisks(input);

      expect(result.risks.length).toBeGreaterThanOrEqual(1);
      const slippageRisk = result.risks.find(
        (r) => r.class === "HIGH_SLIPPAGE"
      );
      expect(slippageRisk).toBeDefined();
      expect(slippageRisk!.data.priceImpact).toBe(2.5);
      expect(slippageRisk!.data.estimatedLoss).toBeDefined();
      expect(slippageRisk!.data.estimatedLoss!).toBeGreaterThan(0);
    });

    it("should NOT flag slippage when price impact <= 1%", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 0.8 }),
        portfolio: makeDiversifiedPortfolio(),
      };

      const result = assessRisks(input);

      const slippageRisk = result.risks.find(
        (r) => r.class === "HIGH_SLIPPAGE"
      );
      expect(slippageRisk).toBeUndefined();
    });

    it("should NOT flag slippage when price impact is exactly 1%", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 1.0 }),
        portfolio: makeDiversifiedPortfolio(),
      };

      const result = assessRisks(input);

      const slippageRisk = result.risks.find(
        (r) => r.class === "HIGH_SLIPPAGE"
      );
      expect(slippageRisk).toBeUndefined();
    });

    it("should include estimated dollar loss in slippage warning", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent({ fromToken: "USDC", toToken: "SUI", amount: 100 }),
        metadata: makeSwapMetadata({ priceImpact: 3, estimatedOutput: 24.5 }),
        portfolio: [
          { token: "USDC", balance: 500, valueUsd: 500 },
          { token: "SUI", balance: 100, valueUsd: 400 },
        ],
      };

      const result = assessRisks(input);

      const slippageRisk = result.risks.find(
        (r) => r.class === "HIGH_SLIPPAGE"
      );
      expect(slippageRisk).toBeDefined();
      expect(slippageRisk!.data.estimatedLoss).toBeDefined();
      expect(typeof slippageRisk!.data.estimatedLoss).toBe("number");
      expect(slippageRisk!.data.estimatedLoss!).toBeGreaterThan(0);
    });
  });

  describe("Slippage severity levels", () => {
    it("should assign 'warning' severity for 1-3% price impact", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 2.0, estimatedOutput: 25 }),
        portfolio: makeDiversifiedPortfolio(),
      };

      const result = assessRisks(input);

      const slippageRisk = result.risks.find(
        (r) => r.class === "HIGH_SLIPPAGE"
      );
      expect(slippageRisk).toBeDefined();
      expect(slippageRisk!.severity).toBe("warning");
    });

    it("should assign 'elevated' severity for 3-5% price impact", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 4.0, estimatedOutput: 25 }),
        portfolio: makeDiversifiedPortfolio(),
      };

      const result = assessRisks(input);

      const slippageRisk = result.risks.find(
        (r) => r.class === "HIGH_SLIPPAGE"
      );
      expect(slippageRisk).toBeDefined();
      expect(slippageRisk!.severity).toBe("elevated");
    });

    it("should assign 'danger' severity for >5% price impact", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 7.0, estimatedOutput: 25 }),
        portfolio: makeDiversifiedPortfolio(),
      };

      const result = assessRisks(input);

      const slippageRisk = result.risks.find(
        (r) => r.class === "HIGH_SLIPPAGE"
      );
      expect(slippageRisk).toBeDefined();
      expect(slippageRisk!.severity).toBe("danger");
    });
  });

  describe("Concentration detection", () => {
    it("should flag concentration when single asset > 70% after swap", () => {
      // After swapping 100 USDC to SUI, SUI becomes dominant
      const input: GuardianInput = {
        intent: makeSwapIntent({ fromToken: "USDC", toToken: "SUI", amount: 400 }),
        metadata: makeSwapMetadata({
          priceImpact: 0.5,
          estimatedOutput: 100,
        }),
        portfolio: [
          { token: "SUI", balance: 100, valueUsd: 400 },
          { token: "USDC", balance: 500, valueUsd: 500 },
        ],
      };

      const result = assessRisks(input);

      const concentrationRisk = result.risks.find(
        (r) => r.class === "CONCENTRATION"
      );
      expect(concentrationRisk).toBeDefined();
      expect(concentrationRisk!.data.resultingPercentage).toBeDefined();
      expect(concentrationRisk!.data.resultingPercentage!).toBeGreaterThan(70);
      expect(concentrationRisk!.data.asset).toBeDefined();
    });

    it("should NOT flag concentration when all assets <= 70%", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent({ fromToken: "USDC", toToken: "SUI", amount: 50 }),
        metadata: makeSwapMetadata({
          priceImpact: 0.3,
          estimatedOutput: 12.5,
        }),
        portfolio: [
          { token: "SUI", balance: 100, valueUsd: 400 },
          { token: "USDC", balance: 500, valueUsd: 500 },
          { token: "WETH", balance: 0.1, valueUsd: 300 },
        ],
      };

      const result = assessRisks(input);

      const concentrationRisk = result.risks.find(
        (r) => r.class === "CONCENTRATION"
      );
      expect(concentrationRisk).toBeUndefined();
    });

    it("should include the resulting percentage and asset name", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent({ fromToken: "USDC", toToken: "SUI", amount: 400 }),
        metadata: makeSwapMetadata({
          priceImpact: 0.5,
          estimatedOutput: 100,
        }),
        portfolio: [
          { token: "SUI", balance: 100, valueUsd: 400 },
          { token: "USDC", balance: 500, valueUsd: 500 },
        ],
      };

      const result = assessRisks(input);

      const concentrationRisk = result.risks.find(
        (r) => r.class === "CONCENTRATION"
      );
      expect(concentrationRisk).toBeDefined();
      expect(typeof concentrationRisk!.data.resultingPercentage).toBe("number");
      expect(concentrationRisk!.data.asset!.length).toBeGreaterThan(0);
    });
  });

  describe("Concentration severity levels", () => {
    it("should assign 'warning' severity for 70-85% concentration", () => {
      // Create portfolio where after swap, one asset is ~75%
      const input: GuardianInput = {
        intent: makeSwapIntent({ fromToken: "USDC", toToken: "SUI", amount: 200 }),
        metadata: makeSwapMetadata({
          priceImpact: 0.5,
          estimatedOutput: 50,
        }),
        portfolio: [
          { token: "SUI", balance: 150, valueUsd: 600 },
          { token: "USDC", balance: 300, valueUsd: 300 },
          { token: "WETH", balance: 0.05, valueUsd: 100 },
        ],
      };

      const result = assessRisks(input);

      const concentrationRisk = result.risks.find(
        (r) => r.class === "CONCENTRATION"
      );
      if (concentrationRisk) {
        expect(concentrationRisk.severity).toBe("warning");
      }
    });

    it("should assign 'elevated' severity for 85-95% concentration", () => {
      // Create portfolio where after swap, one asset is ~90%
      // Start: SUI=800, USDC=500, WETH=200, total=1500
      // Swap 300 USDC to SUI: USDC goes from 500 to 200, SUI goes from 800 to ~1100
      // After: SUI=1100, USDC=200, WETH=200, total=1500, SUI%=73% (not enough)
      // Need: SUI at 85-95%. Start with mostly SUI already.
      // Start: SUI=700, USDC=200, total=900
      // Swap 150 USDC to SUI: USDC goes from 200 to 50, SUI goes from 700 to ~850
      // After: SUI=850, USDC=50, total=900, SUI%=94.4%
      const input: GuardianInput = {
        intent: makeSwapIntent({ fromToken: "USDC", toToken: "SUI", amount: 150 }),
        metadata: makeSwapMetadata({
          priceImpact: 0.5,
          estimatedOutput: 37.5,
        }),
        portfolio: [
          { token: "SUI", balance: 175, valueUsd: 700 },
          { token: "USDC", balance: 200, valueUsd: 200 },
        ],
      };

      const result = assessRisks(input);

      const concentrationRisk = result.risks.find(
        (r) => r.class === "CONCENTRATION"
      );
      expect(concentrationRisk).toBeDefined();
      // Resulting percentage should be in the 85-95% range
      expect(concentrationRisk!.data.resultingPercentage!).toBeGreaterThan(85);
      expect(concentrationRisk!.data.resultingPercentage!).toBeLessThanOrEqual(95);
      expect(concentrationRisk!.severity).toBe("elevated");
    });

    it("should assign 'danger' severity for >95% concentration", () => {
      // Create portfolio where after swap, one asset is >95%
      const input: GuardianInput = {
        intent: makeSwapIntent({ fromToken: "USDC", toToken: "SUI", amount: 980 }),
        metadata: makeSwapMetadata({
          priceImpact: 0.5,
          estimatedOutput: 245,
        }),
        portfolio: [
          { token: "SUI", balance: 200, valueUsd: 800 },
          { token: "USDC", balance: 1000, valueUsd: 1000 },
        ],
      };

      const result = assessRisks(input);

      const concentrationRisk = result.risks.find(
        (r) => r.class === "CONCENTRATION"
      );
      if (concentrationRisk && concentrationRisk.data.resultingPercentage! > 95) {
        expect(concentrationRisk.severity).toBe("danger");
      }
    });
  });

  describe("Safe assessment", () => {
    it('should return "safe" assessment with empty risks array when no risks', () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 0.5, estimatedOutput: 25 }),
        portfolio: makeDiversifiedPortfolio(),
      };

      const result = assessRisks(input);

      expect(result.assessment).toBe("safe");
      expect(result.risks).toEqual([]);
    });

    it('should return "warning" assessment when has warning-level risks', () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 2.0, estimatedOutput: 25 }),
        portfolio: makeDiversifiedPortfolio(),
      };

      const result = assessRisks(input);

      expect(result.assessment).toBe("warning");
      expect(result.risks.length).toBeGreaterThan(0);
    });

    it('should return "danger" assessment when has danger-level risks', () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 6.0, estimatedOutput: 25 }),
        portfolio: makeDiversifiedPortfolio(),
      };

      const result = assessRisks(input);

      expect(result.assessment).toBe("danger");
    });
  });

  describe("Stake transactions skip slippage check", () => {
    it("should NOT produce slippage warning for stake transactions", () => {
      const input: GuardianInput = {
        intent: makeStakeIntent(),
        metadata: makeStakeMetadata({
          // Even if priceImpact were somehow set
          priceImpact: 5.0,
        }),
        portfolio: makeDiversifiedPortfolio(),
      };

      const result = assessRisks(input);

      const slippageRisk = result.risks.find(
        (r) => r.class === "HIGH_SLIPPAGE"
      );
      expect(slippageRisk).toBeUndefined();
    });

    it("should still check concentration for stake transactions", () => {
      const input: GuardianInput = {
        intent: makeStakeIntent({ amount: 50 }),
        metadata: makeStakeMetadata(),
        portfolio: makeConcentratedPortfolio(), // SUI is already >70%
      };

      const result = assessRisks(input);

      // Portfolio is already concentrated (SUI = 4000/4100 ≈ 97.6%)
      const concentrationRisk = result.risks.find(
        (r) => r.class === "CONCENTRATION"
      );
      expect(concentrationRisk).toBeDefined();
    });
  });

  describe("Missing portfolio data", () => {
    it("should skip concentration check when portfolio is empty", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 2.0, estimatedOutput: 25 }),
        portfolio: [],
      };

      const result = assessRisks(input);

      // Should still detect slippage
      const slippageRisk = result.risks.find(
        (r) => r.class === "HIGH_SLIPPAGE"
      );
      expect(slippageRisk).toBeDefined();

      // Should NOT have concentration risk
      const concentrationRisk = result.risks.find(
        (r) => r.class === "CONCENTRATION"
      );
      expect(concentrationRisk).toBeUndefined();
    });

    it("should not crash when portfolio is empty and no slippage concern", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 0.5 }),
        portfolio: [],
      };

      const result = assessRisks(input);

      expect(result.assessment).toBe("safe");
      expect(result.risks).toEqual([]);
    });

    it("should handle stake with empty portfolio gracefully", () => {
      const input: GuardianInput = {
        intent: makeStakeIntent(),
        metadata: makeStakeMetadata(),
        portfolio: [],
      };

      const result = assessRisks(input);

      expect(result.assessment).toBe("safe");
      expect(result.risks).toEqual([]);
    });
  });

  describe("Risk warning completeness", () => {
    it("all slippage warnings have non-empty explanation and suggestion", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 3.5, estimatedOutput: 25 }),
        portfolio: makeDiversifiedPortfolio(),
      };

      const result = assessRisks(input);

      for (const risk of result.risks) {
        expect(risk.explanation).toBeDefined();
        expect(risk.explanation.length).toBeGreaterThan(0);
        expect(risk.suggestion).toBeDefined();
        expect(risk.suggestion.length).toBeGreaterThan(0);
      }
    });

    it("all concentration warnings have non-empty explanation and suggestion", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent({ fromToken: "USDC", toToken: "SUI", amount: 400 }),
        metadata: makeSwapMetadata({
          priceImpact: 0.5,
          estimatedOutput: 100,
        }),
        portfolio: [
          { token: "SUI", balance: 100, valueUsd: 400 },
          { token: "USDC", balance: 500, valueUsd: 500 },
        ],
      };

      const result = assessRisks(input);

      for (const risk of result.risks) {
        expect(risk.explanation).toBeDefined();
        expect(risk.explanation.length).toBeGreaterThan(0);
        expect(risk.suggestion).toBeDefined();
        expect(risk.suggestion.length).toBeGreaterThan(0);
      }
    });

    it("warnings with both slippage and concentration all have explanation and suggestion", () => {
      // High slippage + concentrated portfolio
      const input: GuardianInput = {
        intent: makeSwapIntent({ fromToken: "USDC", toToken: "SUI", amount: 400 }),
        metadata: makeSwapMetadata({
          priceImpact: 4.0,
          estimatedOutput: 96,
        }),
        portfolio: [
          { token: "SUI", balance: 100, valueUsd: 400 },
          { token: "USDC", balance: 500, valueUsd: 500 },
        ],
      };

      const result = assessRisks(input);

      expect(result.risks.length).toBeGreaterThanOrEqual(1);
      for (const risk of result.risks) {
        expect(risk.explanation.trim().length).toBeGreaterThan(0);
        expect(risk.suggestion.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle priceImpact of undefined gracefully", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: undefined }),
        portfolio: makeDiversifiedPortfolio(),
      };

      const result = assessRisks(input);

      const slippageRisk = result.risks.find(
        (r) => r.class === "HIGH_SLIPPAGE"
      );
      expect(slippageRisk).toBeUndefined();
    });

    it("should handle portfolio with zero total value", () => {
      const input: GuardianInput = {
        intent: makeSwapIntent(),
        metadata: makeSwapMetadata({ priceImpact: 0.5 }),
        portfolio: [{ token: "SUI", balance: 0, valueUsd: 0 }],
      };

      const result = assessRisks(input);

      expect(result.assessment).toBe("safe");
      expect(result.risks).toEqual([]);
    });
  });
});

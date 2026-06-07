// ============================================================
// DeFi Copilot — Guardian Risk Assessment Service
// Deterministic risk checks: slippage and concentration
// Pure function — no async, no external calls, no LLM
// ============================================================

import {
  GuardianInput,
  GuardianOutput,
  RiskWarning,
  StructuredIntent,
  PortfolioBalance,
  TransactionMetadata,
} from "@/types";

/**
 * Determine slippage severity based on price impact percentage.
 */
function getSlippageSeverity(priceImpact: number): RiskWarning["severity"] {
  if (priceImpact > 5) return "danger";
  if (priceImpact > 3) return "elevated";
  return "warning";
}

/**
 * Determine concentration severity based on resulting percentage.
 */
function getConcentrationSeverity(
  percentage: number
): RiskWarning["severity"] {
  if (percentage > 95) return "danger";
  if (percentage > 85) return "elevated";
  return "warning";
}

/**
 * Determine overall assessment from risk list.
 */
function determineAssessment(
  risks: RiskWarning[]
): GuardianOutput["assessment"] {
  if (risks.length === 0) return "safe";
  if (risks.some((r) => r.severity === "danger")) return "danger";
  return "warning";
}

/**
 * Calculate the portfolio state after a swap transaction.
 * Returns updated portfolio balances array.
 */
function calculatePostSwapPortfolio(
  portfolio: PortfolioBalance[],
  intent: StructuredIntent,
  metadata: TransactionMetadata
): PortfolioBalance[] {
  if (intent.action !== "swap") return portfolio;

  const fromToken = intent.fromToken;
  const toToken = intent.toToken;
  const amount = intent.amount;

  // Find the from-token in portfolio
  const fromEntry = portfolio.find(
    (p) => p.token.toLowerCase() === fromToken.toLowerCase()
  );

  // Calculate the USD value being swapped out
  let swapValueUsd = 0;
  if (fromEntry && fromEntry.balance > 0) {
    const pricePerUnit = fromEntry.valueUsd / fromEntry.balance;
    swapValueUsd = amount * pricePerUnit;
  }

  // Estimate USD value of what we receive (use estimatedOutput if available)
  let receiveValueUsd = swapValueUsd; // Default: same value
  if (metadata.estimatedOutput && metadata.priceImpact !== undefined) {
    // Adjust for price impact
    receiveValueUsd = swapValueUsd * (1 - metadata.priceImpact / 100);
  }

  // Build updated portfolio
  const updatedPortfolio: PortfolioBalance[] = portfolio.map((p) => {
    if (p.token.toLowerCase() === fromToken.toLowerCase()) {
      const pricePerUnit = p.balance > 0 ? p.valueUsd / p.balance : 0;
      const newBalance = Math.max(0, p.balance - amount);
      return {
        token: p.token,
        balance: newBalance,
        valueUsd: newBalance * pricePerUnit,
      };
    }
    return { ...p };
  });

  // Add or update the to-token
  const existingToEntry = updatedPortfolio.find(
    (p) => p.token.toLowerCase() === toToken.toLowerCase()
  );

  if (existingToEntry) {
    existingToEntry.valueUsd += receiveValueUsd;
    if (metadata.estimatedOutput) {
      existingToEntry.balance += metadata.estimatedOutput;
    }
  } else {
    updatedPortfolio.push({
      token: toToken,
      balance: metadata.estimatedOutput || 0,
      valueUsd: receiveValueUsd,
    });
  }

  return updatedPortfolio;
}

/**
 * Calculate the portfolio state after a stake transaction.
 * For stake, SUI moves from liquid to staked — still SUI, just illiquid.
 * We treat staked SUI as the same asset for concentration purposes.
 */
function calculatePostStakePortfolio(
  portfolio: PortfolioBalance[]
): PortfolioBalance[] {
  // Staking doesn't change asset composition — SUI stays as SUI (just staked)
  // So the portfolio proportions remain the same
  return portfolio.map((p) => ({ ...p }));
}

/**
 * Check for concentration risk in a portfolio.
 * Returns a RiskWarning if any single asset > 70% of total value.
 */
function checkConcentration(
  portfolio: PortfolioBalance[]
): RiskWarning | null {
  const totalValue = portfolio.reduce((sum, p) => sum + p.valueUsd, 0);

  if (totalValue <= 0) return null;

  for (const entry of portfolio) {
    const percentage = (entry.valueUsd / totalValue) * 100;

    if (percentage > 70) {
      return {
        class: "CONCENTRATION",
        severity: getConcentrationSeverity(percentage),
        explanation: `After this trade, ${percentage.toFixed(1)}% of your portfolio will be in ${entry.token}.`,
        suggestion:
          "Consider diversifying across multiple assets.",
        data: {
          resultingPercentage: Math.round(percentage * 10) / 10,
          asset: entry.token,
        },
      };
    }
  }

  return null;
}

/**
 * Assess risks for a given transaction intent.
 *
 * This is a PURE, DETERMINISTIC function — no async, no external calls, no LLM.
 * Uses data already available in the input (intent, metadata, portfolio).
 */
export function assessRisks(input: GuardianInput): GuardianOutput {
  const { intent, metadata, portfolio } = input;
  const risks: RiskWarning[] = [];

  // 1. Slippage check — only for swap transactions
  if (
    intent.action === "swap" &&
    metadata.priceImpact !== undefined &&
    metadata.priceImpact > 1
  ) {
    const priceImpact = metadata.priceImpact;

    // Estimate dollar loss
    let estimatedLoss = 0;
    if (metadata.estimatedOutput !== undefined) {
      // Loss is the difference between what you'd get at 0% impact vs actual
      // Simple approach: loss = estimatedOutput * (priceImpact / 100)
      // But estimatedOutput already includes the impact, so:
      // lossless output = estimatedOutput / (1 - priceImpact/100)
      // loss = lossless - estimatedOutput
      const losslessOutput =
        metadata.estimatedOutput / (1 - priceImpact / 100);
      estimatedLoss = losslessOutput - metadata.estimatedOutput;

      // If we have portfolio data, try to convert to USD
      const toToken =
        intent.action === "swap" ? intent.toToken : "";
      const toEntry = portfolio.find(
        (p) => p.token.toLowerCase() === toToken.toLowerCase()
      );

      if (toEntry && toEntry.balance > 0) {
        const pricePerUnit = toEntry.valueUsd / toEntry.balance;
        estimatedLoss = estimatedLoss * pricePerUnit;
      }
    }

    risks.push({
      class: "HIGH_SLIPPAGE",
      severity: getSlippageSeverity(priceImpact),
      explanation: `Price impact is ${priceImpact.toFixed(1)}%. You'll receive about $${estimatedLoss.toFixed(2)} less than the market rate.`,
      suggestion:
        "Consider splitting into smaller trades to reduce price impact.",
      data: {
        priceImpact,
        estimatedLoss: Math.round(estimatedLoss * 100) / 100,
      },
    });
  }

  // 2. Concentration check — requires portfolio data
  if (portfolio.length > 0) {
    // Calculate post-transaction portfolio
    let postPortfolio: PortfolioBalance[];

    if (intent.action === "swap") {
      postPortfolio = calculatePostSwapPortfolio(
        portfolio,
        intent,
        metadata
      );
    } else {
      postPortfolio = calculatePostStakePortfolio(portfolio);
    }

    // Filter out zero-value entries
    const nonZeroPortfolio = postPortfolio.filter((p) => p.valueUsd > 0);

    const concentrationRisk = checkConcentration(nonZeroPortfolio);
    if (concentrationRisk) {
      risks.push(concentrationRisk);
    }
  }

  // 3. Determine overall assessment
  const assessment = determineAssessment(risks);

  return {
    assessment,
    risks,
  };
}

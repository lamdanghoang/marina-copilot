// ============================================================
// Marina Copilot — Guardian Risk Assessment Service
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
  MemoryRecord,
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
 * Extract transaction history from the last 30 days from memory records.
 * Returns records of type "transaction" within the 30-day window.
 */
function getRecentTransactionHistory(
  memories: MemoryRecord[] | undefined,
  nowMs: number = Date.now()
): MemoryRecord[] {
  if (!memories || memories.length === 0) return [];

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const cutoff = nowMs - thirtyDaysMs;

  return memories.filter(
    (m) => m.type === "transaction" && m.timestamp >= cutoff
  );
}

/**
 * Parse a transaction memory record to extract the token that was acquired (bought).
 * Looks for patterns like "Swapped X USDC to SUI" or metadata with tokens/action info.
 */
function extractAcquiredToken(memory: MemoryRecord): string | null {
  // First try metadata — most reliable
  const meta = memory.metadata;
  if (meta) {
    // If action is "swap" and tokens array has [fromToken, toToken], the acquired token is toToken
    if (meta.action === "swap" && Array.isArray(meta.tokens) && meta.tokens.length >= 2) {
      return (meta.tokens[1] as string) || null;
    }
    // If action is "stake", the token stays the same (SUI → staked SUI)
    if (meta.action === "stake") {
      return null; // Staking doesn't change asset composition for concentration
    }
  }

  // Fallback: parse content string for swap patterns
  const content = memory.content;
  // Pattern: "Swapped X TOKEN_A to TOKEN_B" or "swap X TOKEN_A → TOKEN_B"
  const swapMatch = content.match(
    /(?:swapped?|swap)\s+[\d.]+\s+\w+\s+(?:to|→|->)\s+(\w+)/i
  );
  if (swapMatch) {
    return swapMatch[1].toUpperCase();
  }

  return null;
}

/**
 * Calculate cumulative exposure from transaction history.
 * Returns a map of token → estimated cumulative USD value acquired in last 30 days.
 */
function calculateHistoricalExposure(
  transactionHistory: MemoryRecord[]
): Map<string, number> {
  const exposure = new Map<string, number>();

  for (const tx of transactionHistory) {
    const acquiredToken = extractAcquiredToken(tx);
    if (!acquiredToken) continue;

    // Try to get the USD value from metadata
    let txValueUsd = 0;
    const meta = tx.metadata;
    if (meta && Array.isArray(meta.amounts) && meta.amounts.length >= 1) {
      // Use the first amount as an approximation of value
      // In real implementation this would use historical prices
      txValueUsd = (meta.amounts[0] as number) || 0;
    }

    const current = exposure.get(acquiredToken.toUpperCase()) || 0;
    exposure.set(acquiredToken.toUpperCase(), current + txValueUsd);
  }

  return exposure;
}

/**
 * Check for concentration risk in a portfolio, considering cumulative historical exposure.
 * Returns a RiskWarning if any single asset > 70% of total value when factoring in
 * prior transactions from the last 30 days.
 */
function checkCumulativeConcentration(
  portfolio: PortfolioBalance[],
  memories: MemoryRecord[] | undefined
): RiskWarning | null {
  const totalValue = portfolio.reduce((sum, p) => sum + p.valueUsd, 0);
  if (totalValue <= 0) return null;

  // Get recent transaction history
  const recentHistory = getRecentTransactionHistory(memories);

  if (recentHistory.length === 0) {
    // No history — fall back to standard concentration check
    return checkConcentration(portfolio);
  }

  // Calculate cumulative exposure from history
  const historicalExposure = calculateHistoricalExposure(recentHistory);

  // Check if the current portfolio + historical pattern creates concentration
  for (const entry of portfolio) {
    const tokenUpper = entry.token.toUpperCase();
    const currentPercentage = (entry.valueUsd / totalValue) * 100;

    // Factor in historical exposure: if user has been consistently buying this token,
    // the effective concentration is higher when considering the trend
    const historicalValue = historicalExposure.get(tokenUpper) || 0;

    // Cumulative concentration = current portfolio value + historical acquired value
    // divided by total portfolio + historical total acquired
    const historicalTotal = Array.from(historicalExposure.values()).reduce(
      (sum, v) => sum + v,
      0
    );

    let cumulativePercentage: number;
    if (historicalTotal > 0) {
      // Effective exposure: (current asset value + historical buys of this asset)
      // divided by (total portfolio + total historical buys)
      cumulativePercentage =
        ((entry.valueUsd + historicalValue) / (totalValue + historicalTotal)) * 100;
    } else {
      cumulativePercentage = currentPercentage;
    }

    if (cumulativePercentage > 70) {
      const explanation =
        historicalValue > 0
          ? `Considering your recent transactions, ${cumulativePercentage.toFixed(1)}% of your combined exposure is in ${entry.token}.`
          : `After this trade, ${cumulativePercentage.toFixed(1)}% of your portfolio will be in ${entry.token}.`;

      return {
        class: "CONCENTRATION",
        severity: getConcentrationSeverity(cumulativePercentage),
        explanation,
        suggestion: "Consider diversifying across multiple assets.",
        data: {
          resultingPercentage: Math.round(cumulativePercentage * 10) / 10,
          asset: entry.token,
        },
      };
    }
  }

  return null;
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
 * Uses data already available in the input (intent, metadata, portfolio, memories).
 */
export function assessRisks(input: GuardianInput): GuardianOutput {
  const { intent, metadata, portfolio, memories } = input;
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

    // Use cumulative concentration check when memories are available
    const concentrationRisk = memories && memories.length > 0
      ? checkCumulativeConcentration(nonZeroPortfolio, memories)
      : checkConcentration(nonZeroPortfolio);

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

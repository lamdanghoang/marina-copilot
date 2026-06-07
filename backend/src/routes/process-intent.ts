// ============================================================
// DeFi Copilot — Process Intent Route (Orchestrator)
// POST /api/process-intent
// Pipeline: recall memories → parse intent → compile PTB →
//           assess risks → return preview + transactionBytes
// ============================================================

import { Router, Request, Response } from "express";
import { parseIntent } from "../services/intent-parser";
import { compileSwap, compileStake } from "../services/ptb-compiler";
import { assessRisks } from "../services/guardian";
import {
  ProcessIntentRequest,
  ProcessIntentResponse,
  AppError,
  ErrorCode,
  MemoryRecord,
  PortfolioBalance,
  TokenBalance,
} from "../types";

const router = Router();

/**
 * Build PortfolioBalance[] from TokenBalance[] for Guardian input.
 */
function buildPortfolio(balances: TokenBalance[]): PortfolioBalance[] {
  if (!balances || balances.length === 0) return [];
  return balances
    .filter((b) => b.balance > 0)
    .map((b) => ({
      token: b.symbol,
      balance: b.balance,
      valueUsd: b.valueUsd ?? 0,
    }));
}

/**
 * Check if a value is an AppError (has a `code` field from ErrorCode enum).
 */
function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    Object.values(ErrorCode).includes((value as AppError).code)
  );
}

router.post("/", async (req: Request, res: Response) => {
  const {
    message,
    walletAddress,
    conversationHistory,
    balances,
  } = req.body as ProcessIntentRequest;

  // Validate required fields
  if (!message || !walletAddress) {
    const response: ProcessIntentResponse = {
      type: "error",
      error: {
        message: "Message and wallet address are required.",
        suggestion: "Please connect your wallet and enter a message.",
      },
    };
    return res.status(400).json(response);
  }

  try {
    // --- Step 1: Recall memories (MemWal) — graceful degradation ---
    let memories: MemoryRecord[] = [];
    try {
      // TODO: Wire MemWal recall in task 13. For now, use empty array.
      memories = [];
    } catch (error) {
      // Silent degradation — proceed without memory
      console.error("[Memory] Recall failed:", error);
    }

    // --- Step 2: Parse intent (LLM) ---
    const parserOutput = await parseIntent({
      message,
      memories,
      balances: balances || [],
      conversationHistory: conversationHistory || [],
    });

    // --- Step 3: If clarification needed → return early ---
    if (!parserOutput.intent) {
      const response: ProcessIntentResponse = {
        type: "clarification",
        clarification: {
          message: parserOutput.clarification || "Could you provide more details?",
        },
      };
      return res.json(response);
    }

    // --- Step 4: Compile PTB ---
    const intent = parserOutput.intent;
    let compiledResult;

    if (intent.action === "swap") {
      compiledResult = await compileSwap(intent, walletAddress);
    } else if (intent.action === "stake") {
      compiledResult = await compileStake(intent, walletAddress);
    } else {
      const response: ProcessIntentResponse = {
        type: "error",
        error: {
          message: "Unsupported action type.",
          suggestion: "I can help with swaps and staking on Sui.",
        },
      };
      return res.json(response);
    }

    // Check if compilation returned an error
    if (isAppError(compiledResult)) {
      const response: ProcessIntentResponse = {
        type: "error",
        error: {
          message: compiledResult.message,
          suggestion: compiledResult.suggestion,
        },
      };
      return res.json(response);
    }

    // --- Step 5: Assess risks (Guardian — pure/sync) ---
    const portfolio = buildPortfolio(balances || []);
    const guardianOutput = assessRisks({
      intent,
      metadata: compiledResult.metadata,
      portfolio,
    });

    // --- Step 6: Return preview ---
    const response: ProcessIntentResponse = {
      type: "preview",
      preview: {
        steps: compiledResult.metadata.steps,
        metadata: compiledResult.metadata,
        risks: guardianOutput.risks,
        assessment: guardianOutput.assessment,
        transactionBytes: compiledResult.transactionBytes,
      },
    };

    return res.json(response);
  } catch (error: unknown) {
    // Handle AppError thrown by services (LLM timeout, LLM error)
    if (isAppError(error)) {
      const response: ProcessIntentResponse = {
        type: "error",
        error: {
          message: error.message,
          suggestion: error.suggestion,
        },
      };
      return res.json(response);
    }

    // Unexpected errors
    console.error("[Orchestrator] Unexpected error:", error);
    const response: ProcessIntentResponse = {
      type: "error",
      error: {
        message: "Something went wrong. Please try again.",
        suggestion: "If this keeps happening, try rephrasing your request.",
      },
    };
    return res.status(500).json(response);
  }
});

export default router;

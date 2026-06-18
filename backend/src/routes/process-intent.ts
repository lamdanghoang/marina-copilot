// ============================================================
// Marina Copilot — Process Intent Route (Orchestrator)
// POST /api/process-intent
// Pipeline: recall memories → parse intent → compile PTB →
//           assess risks → return preview + transactionBytes
// ============================================================

import { Router, Request, Response } from "express";
import { parseIntent } from "../services/intent-parser";
import { compileSwap, compileStake, compileTransfer } from "../services/ptb-compiler";
import { assessRisks } from "../services/guardian";
import { recall } from "../services/memory-service";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { config } from "../lib/config";
import {
  ProcessIntentRequest,
  ProcessIntentResponse,
  AppError,
  ErrorCode,
  MemoryRecord,
  PortfolioBalance,
  TokenBalance,
  QueryIntent,
  CreateCapsuleIntent,
} from "../types";

/**
 * Handle read-only query intents (balance, history).
 */
async function handleQueryIntent(intent: QueryIntent, balances: TokenBalance[], walletAddress: string): Promise<string> {
  if (intent.queryType === "balance") {
    try {
      const client = new SuiGrpcClient({ network: "testnet", baseUrl: config.sui.rpcUrl } as any) as any;
      const allBalances = await client.getAllBalances({ owner: walletAddress });

      if (!allBalances || allBalances.length === 0) {
        return "Your wallet has no tokens yet.";
      }

      const lines = allBalances.map((b: any) => {
        const raw = BigInt(b.totalBalance);
        // Detect decimals from coin type
        const isSui = b.coinType === "0x2::sui::SUI";
        const decimals = isSui ? 9 : 6;
        const amount = Number(raw) / 10 ** decimals;
        const symbol = isSui ? "SUI" : b.coinType.split("::").pop() || "UNKNOWN";
        return `• ${symbol}: ${amount.toFixed(isSui ? 4 : 2)}`;
      });

      return `Here's your wallet balance:\n${lines.join("\n")}`;
    } catch (error) {
      console.error("[Query] Balance fetch failed:", error);
      // Fallback to frontend-provided balances
      if (balances && balances.length > 0) {
        const lines = balances.map((b) => `• ${b.symbol}: ${b.balance}`);
        return `Here's your wallet balance:\n${lines.join("\n")}`;
      }
      return "Couldn't fetch balance. Please try again.";
    }
  }

  if (intent.queryType === "history") {
    try {
      const client = new SuiGrpcClient({ network: "testnet", baseUrl: config.sui.rpcUrl } as any) as any;
      const txs = await client.queryTransactionBlocks({
        filter: { FromAddress: walletAddress },
        options: { showEffects: true, showInput: true },
        limit: 10,
        order: "descending",
      });

      if (!txs.data || txs.data.length === 0) {
        return "No transactions found for your wallet yet.";
      }

      const lines = txs.data.map((tx: any) => {
        const status = tx.effects?.status?.status === "success" ? "✅" : "❌";
        const gasUsed = tx.effects?.gasUsed;
        const gas = gasUsed
          ? (Number(BigInt(gasUsed.computationCost) + BigInt(gasUsed.storageCost) - BigInt(gasUsed.storageRebate)) / 1e9).toFixed(4)
          : "?";
        const digest = tx.digest.slice(0, 8) + "..." + tx.digest.slice(-4);
        const time = tx.timestampMs
          ? new Date(Number(tx.timestampMs)).toLocaleDateString()
          : "";
        return `${status} ${digest} | Gas: ${gas} SUI | ${time}`;
      });

      return `Your last ${txs.data.length} transactions:\n${lines.join("\n")}`;
    } catch (error) {
      console.error("[Query] History fetch failed:", error);
      return "Couldn't fetch transaction history. Please try again.";
    }
  }

  return "I can check your balance or transaction history. What would you like?";
}

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
    memwalCredentials,
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
    // --- Step 1: Recall memories (MemWal + frontend localStorage) ---
    let memories: MemoryRecord[] = [];
    try {
      memories = await recall(walletAddress, message, 10, memwalCredentials);
    } catch (error) {
      console.error("[Memory] Recall failed:", error);
    }

    // Merge with frontend-sent local memories (fallback when no MemWal)
    const localMemories: string[] = req.body.memories || [];
    if (localMemories.length > 0 && memories.length === 0) {
      memories = localMemories.slice(-10).map((content, i) => ({
        id: `local-${i}`,
        content,
        timestamp: Date.now(),
        type: "transaction" as const,
      }));
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
        memoryIndicator: parserOutput.memoryIndicator,
        clarification: {
          message: parserOutput.clarification || "Could you provide more details?",
        },
      };
      return res.json(response);
    }

    // --- Step 4: Compile PTB ---
    const intent = parserOutput.intent;
    let compiledResult;

    if (intent.action === "query") {
      const infoMessage = await handleQueryIntent(intent, balances || [], walletAddress);
      const response: ProcessIntentResponse = {
        type: "info",
        memoryIndicator: parserOutput.memoryIndicator,
        info: { message: infoMessage },
      };
      return res.json(response);
    }

    if (intent.action === "create_capsule") {
      const capsuleIntent = intent as CreateCapsuleIntent;
      const response: ProcessIntentResponse = {
        type: "action_request",
        memoryIndicator: parserOutput.memoryIndicator,
        actionRequest: {
          action: "create_capsule",
          params: {
            content: capsuleIntent.content,
            unlockAfterMinutes: capsuleIntent.unlockAfterMinutes,
            recipient: capsuleIntent.recipient || "self",
          },
          message: `I'll create a time capsule that unlocks in ${capsuleIntent.unlockAfterMinutes} minutes. The message will be encrypted with Seal and stored on Walrus.`,
        },
      };
      return res.json(response);
    }

    if (intent.action === "upload_file") {
      const response: ProcessIntentResponse = {
        type: "action_request",
        memoryIndicator: parserOutput.memoryIndicator,
        actionRequest: {
          action: "upload_file",
          params: {},
          message: "I'll help you upload a file to Walrus decentralized storage. Please select a file.",
        },
      };
      return res.json(response);
    }

    if (intent.action === "swap") {
      compiledResult = await compileSwap(intent, walletAddress);

      // Requirement 9.4: If preferred DEX has no route, retry without DEX preference
      if (
        isAppError(compiledResult) &&
        compiledResult.code === ErrorCode.NO_ROUTE &&
        intent.dex &&
        parserOutput.memoryIndicator
      ) {
        const fallbackIntent = { ...intent, dex: undefined };
        compiledResult = await compileSwap(fallbackIntent, walletAddress);

        // If fallback succeeds, update memory indicator to inform user
        if (!isAppError(compiledResult)) {
          parserOutput.memoryIndicator = null;
          // Add a note that preferred DEX was unavailable
          compiledResult.metadata.steps[0].description =
            compiledResult.metadata.steps[0].description +
            ` (${intent.dex} unavailable for this pair)`;
        }
      }
    } else if (intent.action === "stake") {
      compiledResult = await compileStake(intent, walletAddress);
    } else if (intent.action === "transfer") {
      compiledResult = await compileTransfer(intent, walletAddress);
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
      memories,
    });

    // --- Step 6: Return preview ---
    const response: ProcessIntentResponse = {
      type: "preview",
      memoryIndicator: parserOutput.memoryIndicator,
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

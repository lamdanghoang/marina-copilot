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
      const graphqlUrl = "https://sui-testnet.mystenlabs.com/graphql";
      const query = `{
        transactionBlocks(filter: { signAddress: "${walletAddress}" }, last: 10) {
          nodes {
            digest
            effects { status timestamp }
          }
        }
      }`;
      const resp = await fetch(graphqlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json: any = await resp.json();
      const nodes = json.data?.transactionBlocks?.nodes;

      if (!nodes || nodes.length === 0) {
        return "No transactions found for your wallet yet.";
      }

      const lines = nodes.map((tx: any) => {
        const status = tx.effects?.status === "SUCCESS" ? "✅" : "❌";
        const digest = tx.digest.slice(0, 8) + "..." + tx.digest.slice(-4);
        const time = tx.effects?.timestamp ? new Date(tx.effects.timestamp).toLocaleDateString() : "";
        return `${status} ${digest} | ${time}`;
      });

      return `Your last ${nodes.length} transactions:\n${lines.join("\n")}`;
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

import { buildLLMContext, callLLMStream } from "../services/llm-client";

router.post("/stream", async (req: Request, res: Response) => {
  const { message, walletAddress, balances, memories: localMemories = [], contacts = [] } = req.body;
  if (!message || !walletAddress) {
    res.status(400).json({ error: "Missing message or walletAddress" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    let memRecords: MemoryRecord[] = [];
    if (localMemories.length > 0) {
      memRecords = localMemories.slice(-10).map((content: string, i: number) => ({
        id: `local-${i}`, content, type: "preference" as const, timestamp: Date.now(),
      }));
    }

    const context = buildLLMContext({
      message, balances,
      conversationHistory: req.body.conversationHistory || [],
      memories: memRecords, contacts,
    });

    // Override system prompt for streaming — plain text response, no JSON
    context.systemPrompt = "You are Marina Copilot, an AI assistant on Sui blockchain. Answer knowledge questions clearly and concisely in plain text. Do NOT use markdown formatting (no **, no ##, no bullet -). Use emojis sparingly for visual separation. Keep answers short (under 150 words). If you have user memories, reference them naturally. Do NOT output JSON.";

    await callLLMStream(context, (chunk) => {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    });

    res.write(`data: [DONE]\n\n`);
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
  } finally {
    res.end();
  }
});

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
      contacts: req.body.contacts || [],
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
      const hasFile = message.includes("[Attached file:");
      const response: ProcessIntentResponse = {
        type: "action_request",
        memoryIndicator: parserOutput.memoryIndicator,
        actionRequest: {
          action: "upload_file",
          params: { epochs: intent.epochs || 5 },
          message: hasFile ? `I'll upload your file to Walrus for ${intent.epochs || 5} epochs.` : "Please attach a file to upload.",
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

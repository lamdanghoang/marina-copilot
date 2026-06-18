// ============================================================
// Marina Copilot — LLM Client (AWS Bedrock / Claude Sonnet)
// Single merged call: intent reasoning + risk flagging
// ============================================================

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "../lib/config";
import {
  AppError,
  ErrorCode,
  IntentParserInput,
  TokenBalance,
  MemoryRecord,
} from "../types";
import { SUPPORTED_TOKENS } from "../types/config";

// --- Types ---

export interface LLMContext {
  systemPrompt: string;
  userMessage: string;
  memories: string[];
  balances: string;
  conversationHistory: Array<{ role: string; content: string }>;
}

// --- Bedrock Client ---

let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: config.aws.region,
      ...(config.aws.accessKeyId && config.aws.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.aws.accessKeyId,
              secretAccessKey: config.aws.secretAccessKey,
            },
          }
        : {}),
    });
  }
  return bedrockClient;
}

/** Reset the cached client (for testing) */
export function resetBedrockClient(client?: BedrockRuntimeClient): void {
  bedrockClient = client || null;
}

// --- System Prompt ---

export function buildSystemPrompt(): string {
  const tokenList = SUPPORTED_TOKENS.map((t) => t.symbol).join(", ");

  return `You are a DeFi financial advisor on the Sui blockchain. You help users execute safe token swaps and staking operations.

## Available Actions
- **swap**: Exchange tokens via Cetus DEX aggregator. Required fields: fromToken, toToken, amount. Optional: dex, slippageTolerance.
- **stake**: Stake SUI with a validator. Required fields: token (always "SUI"), amount. Optional: validator.
- **query**: Read-only information request. Required fields: queryType ("balance" or "history"). No transaction needed.
- **create_capsule**: Create a time-locked encrypted message stored on Walrus. Required fields: content (the secret message), unlockAfterMinutes (how long until decryptable). Optional: recipient.
- **upload_file**: Upload a file to Walrus decentralized storage. No fields needed (triggers file picker on frontend).
- **transfer**: Send tokens to another address. Required fields: token (symbol), amount, recipient (Sui address).

## Supported Tokens
${tokenList}

## Your Task
Analyze the user's message and return a JSON response with:
1. Your reasoning about what the user wants
2. A structured intent (or null if clarification is needed)
3. A clarification question (or null if intent is clear)
4. Risk flags based on the user's balances and request
5. A memory indicator if you used a stored preference

## Output Format
You MUST return valid JSON matching this exact schema:
{
  "reasoning": "Brief analysis of the user's request",
  "intent": {
    "action": "swap" | "stake" | "query" | "create_capsule" | "upload_file" | "transfer",
    "fromToken": "TOKEN_SYMBOL",
    "toToken": "TOKEN_SYMBOL",
    "amount": <number>,
    "dex": "optional_dex_name",
    "slippageTolerance": <optional_number>,
    "queryType": "balance" | "history",
    "content": "capsule secret message",
    "unlockAfterMinutes": <number>,
    "recipient": "optional"
  } | null,
  "clarification": "Question to ask user" | null,
  "riskFlags": {
    "slippageConcern": true | false,
    "concentrationConcern": true | false,
    "rationale": "Why these flags were set"
  },
  "memoryIndicator": "Description of applied preference" | null
}

## Rules
- Return intent=null with a clarification question when you are uncertain about any required field
- NEVER guess amounts — if the user says "some" or "a bit", ask for a specific number
- NEVER guess token symbols — if ambiguous, ask which token they mean
- If the user asks about an unsupported action, set intent=null and explain what actions are available
- If a token symbol is not in the supported list, set intent=null and indicate the unrecognized token
- For "check balance", "how much do I have", "what's my balance" → use action "query" with queryType "balance"
- For "transaction history", "recent transactions", "what did I do" → use action "query" with queryType "history"
- For "create capsule", "time capsule", "encrypt a message", "lock this message" → use action "create_capsule" with content and unlockAfterMinutes
- For "upload file", "store file", "save to walrus" → use action "upload_file"
- For "send", "transfer", "send X to address" → use action "transfer" with token, amount, recipient
- For swap intents: set slippageConcern=true if the amount is very large relative to balances
- For any intent: set concentrationConcern=true if it would make one token >70% of portfolio
- Use memory context to fill in defaults (e.g. preferred DEX) without asking again
- Return ONLY the JSON object, no markdown fences, no extra text`;
}

// --- Context Builder ---

export function buildLLMContext(input: IntentParserInput): LLMContext {
  const systemPrompt = buildSystemPrompt();

  const memories = formatMemories(input.memories);
  const balances = formatBalances(input.balances);

  const conversationHistory = input.conversationHistory
    .slice(-6) // Keep last 3 exchanges (6 messages)
    .map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

  return {
    systemPrompt,
    userMessage: input.message,
    memories,
    balances,
    conversationHistory,
  };
}

function formatMemories(memories: MemoryRecord[]): string[] {
  if (!memories || memories.length === 0) return [];

  return memories.slice(0, 10).map((mem) => {
    const prefix = mem.type === "preference" ? "[Preference]" : "[History]";
    return `${prefix} ${mem.content}`;
  });
}

function formatBalances(balances: TokenBalance[]): string {
  if (!balances || balances.length === 0) return "No balance data available.";

  const lines = balances.map((b) => {
    const usdStr = b.valueUsd !== undefined ? ` (~$${b.valueUsd.toFixed(2)})` : "";
    return `${b.symbol}: ${b.balance}${usdStr}`;
  });

  return `Wallet balances:\n${lines.join("\n")}`;
}

// --- Main LLM Call ---

export async function callLLM(context: LLMContext): Promise<string> {
  const client = getBedrockClient();

  // Build messages array for Anthropic Messages API format
  const messages: Array<{ role: string; content: string }> = [];

  // Add conversation history
  for (const msg of context.conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Build the user message with context
  const contextParts: string[] = [];

  if (context.memories.length > 0) {
    contextParts.push(`## User Memory\n${context.memories.join("\n")}`);
  }

  if (context.balances) {
    contextParts.push(`## ${context.balances}`);
  }

  const fullUserMessage = contextParts.length > 0
    ? `${contextParts.join("\n\n")}\n\n## User Request\n${context.userMessage}`
    : context.userMessage;

  messages.push({ role: "user", content: fullUserMessage });

  // Build request body for Anthropic Messages API (Bedrock format)
  const requestBody = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1024,
    system: context.systemPrompt,
    messages,
  });

  const command = new InvokeModelCommand({
    modelId: config.bedrock.modelId,
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(requestBody),
  });

  // Set up abort controller with 8-second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.bedrock.timeoutMs);

  try {
    const response = await client.send(command, {
      abortSignal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response body
    const responseBody = JSON.parse(
      new TextDecoder().decode(response.body)
    );

    // Extract text content from Anthropic Messages API response
    const textContent = responseBody.content?.find(
      (block: { type: string; text?: string }) => block.type === "text"
    );

    if (!textContent?.text) {
      const error: AppError = {
        code: ErrorCode.LLM_ERROR,
        message: "I couldn't process that. Please try again.",
        details: "LLM response contained no text content",
      };
      throw error;
    }

    return textContent.text;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    // Check if it's already an AppError we threw
    if (isAppError(err)) {
      throw err;
    }

    // Check for abort/timeout
    if (err instanceof Error && err.name === "AbortError") {
      const error: AppError = {
        code: ErrorCode.LLM_TIMEOUT,
        message: "I couldn't process that in time. Please try again.",
        suggestion: "Try a simpler request or check your connection.",
        details: `LLM call timed out after ${config.bedrock.timeoutMs}ms`,
      };
      throw error;
    }

    // Generic LLM error
    const error: AppError = {
      code: ErrorCode.LLM_ERROR,
      message: "I couldn't process that. Please try again.",
      suggestion: "If this keeps happening, try rephrasing your request.",
      details: err instanceof Error ? err.message : String(err),
    };
    throw error;
  }
}

// --- Helpers ---

function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "message" in err &&
    Object.values(ErrorCode).includes((err as AppError).code)
  );
}

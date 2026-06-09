// ============================================================
// Marina Copilot — Orchestrator Route Unit Tests
// Tests the /api/process-intent, /api/remember, /api/health routes
// with mocked services
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";

// Mock services before importing routes
vi.mock("../../src/services/intent-parser", () => ({
  parseIntent: vi.fn(),
}));

vi.mock("../../src/services/ptb-compiler", () => ({
  compileSwap: vi.fn(),
  compileStake: vi.fn(),
}));

vi.mock("../../src/services/guardian", () => ({
  assessRisks: vi.fn(),
}));

import processIntentRouter from "../../src/routes/process-intent";
import rememberRouter from "../../src/routes/remember";
import healthRouter from "../../src/routes/health";
import { parseIntent } from "../../src/services/intent-parser";
import { compileSwap, compileStake } from "../../src/services/ptb-compiler";
import { assessRisks } from "../../src/services/guardian";
import { ErrorCode } from "../../src/types";

// --- Test Helper: simulate Express request/response ---

function makeRes() {
  let resolvePromise: (val: { status: number; body: unknown }) => void;
  const promise = new Promise<{ status: number; body: unknown }>((resolve) => {
    resolvePromise = resolve;
  });

  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      resolvePromise!({ status: this.statusCode, body: data });
      return this;
    },
  };

  return { res, promise };
}

function getHandler(router: express.Router) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (router as any).stack[0].route.stack[0].handle;
}

// --- Health Route Tests ---

describe("GET /api/health", () => {
  it("returns status ok with timestamp", async () => {
    const handler = getHandler(healthRouter);
    const { res, promise } = makeRes();

    handler({}, res);
    const result = await promise;

    expect((result.body as { status: string }).status).toBe("ok");
    expect((result.body as { timestamp: number }).timestamp).toBeTypeOf("number");
    expect((result.body as { timestamp: number }).timestamp).toBeGreaterThan(0);
  });
});

// --- Remember Route Tests ---

describe("POST /api/remember", () => {
  it("returns success for valid request", async () => {
    const handler = getHandler(rememberRouter);
    const { res, promise } = makeRes();
    const req = {
      body: {
        walletAddress: "0x1234abcd",
        content: { type: "transaction", content: "Swapped 100 USDC to SUI" },
      },
    };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true });
  });

  it("returns 400 when walletAddress is missing", async () => {
    const handler = getHandler(rememberRouter);
    const { res, promise } = makeRes();
    const req = {
      body: { content: { type: "preference", content: "Prefers Cetus" } },
    };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(400);
  });

  it("returns 400 when content is missing", async () => {
    const handler = getHandler(rememberRouter);
    const { res, promise } = makeRes();
    const req = {
      body: { walletAddress: "0x1234" },
    };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(400);
  });
});

// --- Process Intent Route Tests ---

describe("POST /api/process-intent", () => {
  const mockedParseIntent = vi.mocked(parseIntent);
  const mockedCompileSwap = vi.mocked(compileSwap);
  const mockedCompileStake = vi.mocked(compileStake);
  const mockedAssessRisks = vi.mocked(assessRisks);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseRequest = {
    message: "swap 100 USDC to SUI",
    walletAddress: "0xabcdef1234567890",
    conversationHistory: [],
    balances: [
      { token: "USDC", symbol: "USDC", balance: 500, decimals: 6, valueUsd: 500 },
      { token: "SUI", symbol: "SUI", balance: 10, decimals: 9, valueUsd: 40 },
    ],
  };

  it("returns 400 when message is missing", async () => {
    const handler = getHandler(processIntentRouter);
    const { res, promise } = makeRes();
    const req = { body: { walletAddress: "0x1234" } };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(400);
    expect((result.body as { type: string }).type).toBe("error");
  });

  it("returns 400 when walletAddress is missing", async () => {
    const handler = getHandler(processIntentRouter);
    const { res, promise } = makeRes();
    const req = { body: { message: "swap 100 USDC to SUI" } };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(400);
    expect((result.body as { type: string }).type).toBe("error");
  });

  it("returns clarification when intent is null", async () => {
    mockedParseIntent.mockResolvedValueOnce({
      reasoning: "User didn't specify amount",
      intent: null,
      clarification: "How much USDC would you like to swap?",
      riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
      memoryIndicator: null,
    });

    const handler = getHandler(processIntentRouter);
    const { res, promise } = makeRes();
    const req = { body: baseRequest };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(200);
    const body = result.body as { type: string; clarification: { message: string } };
    expect(body.type).toBe("clarification");
    expect(body.clarification.message).toBe("How much USDC would you like to swap?");
  });

  it("returns preview for successful swap pipeline", async () => {
    mockedParseIntent.mockResolvedValueOnce({
      reasoning: "User wants to swap 100 USDC to SUI",
      intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 100 },
      clarification: null,
      riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
      memoryIndicator: null,
    });

    mockedCompileSwap.mockResolvedValueOnce({
      transactionBytes: "dHJhbnNhY3Rpb25CeXRlcw==",
      metadata: {
        type: "swap",
        steps: [
          { index: 1, description: "Swap 100 USDC → ~24.8 SUI via Cetus", type: "swap" },
          { index: 2, description: "Receive minimum 24.55 SUI", type: "receive" },
        ],
        gasEstimate: 0.005,
        route: ["USDC", "[Cetus]", "SUI"],
        exchangeRate: 0.248,
        estimatedOutput: 24.8,
        minimumOutput: 24.55,
        priceImpact: 0.3,
      },
    });

    mockedAssessRisks.mockReturnValueOnce({
      assessment: "safe",
      risks: [],
    });

    const handler = getHandler(processIntentRouter);
    const { res, promise } = makeRes();
    const req = { body: baseRequest };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(200);
    const body = result.body as {
      type: string;
      preview: {
        steps: unknown[];
        metadata: { type: string };
        risks: unknown[];
        assessment: string;
        transactionBytes: string;
      };
    };
    expect(body.type).toBe("preview");
    expect(body.preview.steps).toHaveLength(2);
    expect(body.preview.metadata.type).toBe("swap");
    expect(body.preview.risks).toHaveLength(0);
    expect(body.preview.assessment).toBe("safe");
    expect(body.preview.transactionBytes).toBe("dHJhbnNhY3Rpb25CeXRlcw==");
  });

  it("returns error when PTB compilation fails", async () => {
    mockedParseIntent.mockResolvedValueOnce({
      reasoning: "User wants to swap 100 USDC to SUI",
      intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 100 },
      clarification: null,
      riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
      memoryIndicator: null,
    });

    mockedCompileSwap.mockResolvedValueOnce({
      code: ErrorCode.NO_ROUTE,
      message: "No route available for USDC → SUI.",
      suggestion: "Try a different token pair or a smaller amount.",
    });

    const handler = getHandler(processIntentRouter);
    const { res, promise } = makeRes();
    const req = { body: baseRequest };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(200);
    const body = result.body as { type: string; error: { message: string; suggestion: string } };
    expect(body.type).toBe("error");
    expect(body.error.message).toContain("No route");
    expect(body.error.suggestion).toBeDefined();
  });

  it("returns error when LLM throws AppError", async () => {
    const llmError = {
      code: ErrorCode.LLM_TIMEOUT,
      message: "I couldn't process that in time. Please try again.",
      suggestion: "Try a simpler request.",
    };
    mockedParseIntent.mockRejectedValueOnce(llmError);

    const handler = getHandler(processIntentRouter);
    const { res, promise } = makeRes();
    const req = { body: baseRequest };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(200);
    const body = result.body as { type: string; error: { message: string } };
    expect(body.type).toBe("error");
    expect(body.error.message).toContain("couldn't process");
  });

  it("returns preview with risks for high-slippage swap", async () => {
    mockedParseIntent.mockResolvedValueOnce({
      reasoning: "User wants to swap 10000 USDC to SUI",
      intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 10000 },
      clarification: null,
      riskFlags: { slippageConcern: true, concentrationConcern: false, rationale: "Large amount" },
      memoryIndicator: null,
    });

    mockedCompileSwap.mockResolvedValueOnce({
      transactionBytes: "Ynl0ZXM=",
      metadata: {
        type: "swap",
        steps: [
          { index: 1, description: "Swap 10000 USDC → ~2400 SUI via Cetus", type: "swap" },
        ],
        gasEstimate: 0.01,
        route: ["USDC", "[Cetus]", "SUI"],
        exchangeRate: 0.24,
        estimatedOutput: 2400,
        minimumOutput: 2376,
        priceImpact: 3.5,
      },
    });

    mockedAssessRisks.mockReturnValueOnce({
      assessment: "warning",
      risks: [
        {
          class: "HIGH_SLIPPAGE",
          severity: "elevated",
          explanation: "Price impact is 3.5%. You'll receive about $84 less than market rate.",
          suggestion: "Consider splitting into smaller trades.",
          data: { priceImpact: 3.5, estimatedLoss: 84 },
        },
      ],
    });

    const handler = getHandler(processIntentRouter);
    const { res, promise } = makeRes();
    const req = { body: { ...baseRequest, message: "swap 10000 USDC to SUI" } };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(200);
    const body = result.body as {
      type: string;
      preview: {
        risks: Array<{ class: string; severity: string }>;
        assessment: string;
      };
    };
    expect(body.type).toBe("preview");
    expect(body.preview.assessment).toBe("warning");
    expect(body.preview.risks).toHaveLength(1);
    expect(body.preview.risks[0].class).toBe("HIGH_SLIPPAGE");
  });

  it("handles stake intent through the pipeline", async () => {
    mockedParseIntent.mockResolvedValueOnce({
      reasoning: "User wants to stake 50 SUI",
      intent: { action: "stake", token: "SUI" as const, amount: 50 },
      clarification: null,
      riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
      memoryIndicator: null,
    });

    mockedCompileStake.mockResolvedValueOnce({
      transactionBytes: "c3Rha2VCeXRlcw==",
      metadata: {
        type: "stake",
        steps: [
          { index: 1, description: "Reserve 0.05 SUI for gas", type: "split" },
          { index: 2, description: "Stake 50 SUI with Mysten Labs", type: "stake" },
        ],
        gasEstimate: 0.003,
        validatorName: "Mysten Labs",
        estimatedApy: 4.25,
      },
    });

    mockedAssessRisks.mockReturnValueOnce({
      assessment: "safe",
      risks: [],
    });

    const handler = getHandler(processIntentRouter);
    const { res, promise } = makeRes();
    const req = { body: { ...baseRequest, message: "stake 50 SUI" } };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(200);
    const body = result.body as {
      type: string;
      preview: {
        metadata: { type: string; validatorName: string; estimatedApy: number };
      };
    };
    expect(body.type).toBe("preview");
    expect(body.preview.metadata.type).toBe("stake");
    expect(body.preview.metadata.validatorName).toBe("Mysten Labs");
    expect(body.preview.metadata.estimatedApy).toBe(4.25);
  });

  it("handles unexpected errors gracefully", async () => {
    mockedParseIntent.mockRejectedValueOnce(new Error("Unexpected failure"));

    const handler = getHandler(processIntentRouter);
    const { res, promise } = makeRes();
    const req = { body: baseRequest };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(500);
    const body = result.body as { type: string; error: { message: string } };
    expect(body.type).toBe("error");
    expect(body.error.message).toContain("Something went wrong");
  });

  it("includes memoryIndicator in preview response when preferences applied", async () => {
    mockedParseIntent.mockResolvedValueOnce({
      reasoning: "User wants to swap, using memory for DEX",
      intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 100, dex: "Cetus" },
      clarification: null,
      riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
      memoryIndicator: "Using Cetus (your preferred DEX)",
    });

    mockedCompileSwap.mockResolvedValueOnce({
      transactionBytes: "dHJhbnNhY3Rpb25CeXRlcw==",
      metadata: {
        type: "swap",
        steps: [{ index: 1, description: "Swap 100 USDC → ~24.8 SUI via Cetus", type: "swap" }],
        gasEstimate: 0.005,
        route: ["USDC", "[Cetus]", "SUI"],
        exchangeRate: 0.248,
        estimatedOutput: 24.8,
        minimumOutput: 24.55,
        priceImpact: 0.3,
      },
    });

    mockedAssessRisks.mockReturnValueOnce({
      assessment: "safe",
      risks: [],
    });

    const handler = getHandler(processIntentRouter);
    const { res, promise } = makeRes();
    const req = { body: baseRequest };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(200);
    const body = result.body as { type: string; memoryIndicator: string };
    expect(body.type).toBe("preview");
    expect(body.memoryIndicator).toBe("Using Cetus (your preferred DEX)");
  });

  it("includes memoryIndicator in clarification response", async () => {
    mockedParseIntent.mockResolvedValueOnce({
      reasoning: "Need more info but recognizing memory",
      intent: null,
      clarification: "How much USDC would you like to swap?",
      riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
      memoryIndicator: "Using Cetus (your preferred DEX)",
    });

    const handler = getHandler(processIntentRouter);
    const { res, promise } = makeRes();
    const req = { body: baseRequest };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(200);
    const body = result.body as { type: string; memoryIndicator: string };
    expect(body.type).toBe("clarification");
    expect(body.memoryIndicator).toBe("Using Cetus (your preferred DEX)");
  });

  it("memoryIndicator is null when no preferences applied", async () => {
    mockedParseIntent.mockResolvedValueOnce({
      reasoning: "User wants to swap 100 USDC to SUI",
      intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 100 },
      clarification: null,
      riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
      memoryIndicator: null,
    });

    mockedCompileSwap.mockResolvedValueOnce({
      transactionBytes: "dHJhbnNhY3Rpb25CeXRlcw==",
      metadata: {
        type: "swap",
        steps: [{ index: 1, description: "Swap 100 USDC → ~24.8 SUI via Cetus", type: "swap" }],
        gasEstimate: 0.005,
        route: ["USDC", "[Cetus]", "SUI"],
        exchangeRate: 0.248,
        estimatedOutput: 24.8,
        minimumOutput: 24.55,
        priceImpact: 0.3,
      },
    });

    mockedAssessRisks.mockReturnValueOnce({
      assessment: "safe",
      risks: [],
    });

    const handler = getHandler(processIntentRouter);
    const { res, promise } = makeRes();
    const req = { body: baseRequest };

    handler(req, res);
    const result = await promise;

    expect(result.status).toBe(200);
    const body = result.body as { type: string; memoryIndicator: string | null };
    expect(body.type).toBe("preview");
    expect(body.memoryIndicator).toBeNull();
  });
});

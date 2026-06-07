import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseIntent, buildUnknownTokenError } from "../../src/services/intent-parser";
import { IntentParserInput, IntentParserOutput, ErrorCode } from "../../src/types";

// Mock the llm-client module
vi.mock("../../src/services/llm-client", () => ({
  buildLLMContext: vi.fn((input: IntentParserInput) => ({
    systemPrompt: "test prompt",
    userMessage: input.message,
    memories: [],
    balances: "SUI: 100",
    conversationHistory: [],
  })),
  callLLM: vi.fn(),
}));

import { callLLM, buildLLMContext } from "../../src/services/llm-client";

const mockCallLLM = vi.mocked(callLLM);
const mockBuildLLMContext = vi.mocked(buildLLMContext);

describe("intent-parser", () => {
  const baseInput: IntentParserInput = {
    message: "Swap 100 USDC to SUI",
    memories: [],
    balances: [
      { token: "0x2::sui::SUI", symbol: "SUI", balance: 50, decimals: 9, valueUsd: 60 },
      { token: "0x...::usdc::USDC", symbol: "USDC", balance: 500, decimals: 6, valueUsd: 500 },
    ],
    conversationHistory: [],
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("parseIntent — successful swap", () => {
    it("parses a valid swap intent from LLM response", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "User wants to swap 100 USDC to SUI",
        intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 100 },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "Normal swap amount" },
        memoryIndicator: null,
      }));

      const result = await parseIntent(baseInput);

      expect(result.intent).not.toBeNull();
      expect(result.intent?.action).toBe("swap");
      if (result.intent?.action === "swap") {
        expect(result.intent.fromToken).toBe("USDC");
        expect(result.intent.toToken).toBe("SUI");
        expect(result.intent.amount).toBe(100);
      }
      expect(result.clarification).toBeNull();
      expect(result.riskFlags.slippageConcern).toBe(false);
      expect(result.riskFlags.concentrationConcern).toBe(false);
    });

    it("parses a valid stake intent from LLM response", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "User wants to stake 50 SUI",
        intent: { action: "stake", token: "SUI", amount: 50 },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: true, rationale: "Large stake" },
        memoryIndicator: null,
      }));

      const input = { ...baseInput, message: "Stake 50 SUI" };
      const result = await parseIntent(input);

      expect(result.intent).not.toBeNull();
      expect(result.intent?.action).toBe("stake");
      if (result.intent?.action === "stake") {
        expect(result.intent.token).toBe("SUI");
        expect(result.intent.amount).toBe(50);
      }
      expect(result.clarification).toBeNull();
      expect(result.riskFlags.concentrationConcern).toBe(true);
    });
  });

  describe("parseIntent — clarification needed", () => {
    it("returns clarification when LLM response has intent=null + clarification", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "User wants to swap but didn't specify amount",
        intent: null,
        clarification: "How much USDC would you like to swap?",
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        memoryIndicator: null,
      }));

      const input = { ...baseInput, message: "Swap USDC to SUI" };
      const result = await parseIntent(input);

      expect(result.intent).toBeNull();
      expect(result.clarification).toBe("How much USDC would you like to swap?");
    });

    it("returns clarification naming missing fields for swap with missing amount", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "User wants to swap but missing amount",
        intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 0 },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        memoryIndicator: null,
      }));

      const result = await parseIntent(baseInput);

      expect(result.intent).toBeNull();
      expect(result.clarification).toContain("amount");
    });

    it("returns clarification naming all missing fields for incomplete swap", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "Very vague swap request",
        intent: { action: "swap", fromToken: "", toToken: "", amount: 0 },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        memoryIndicator: null,
      }));

      const result = await parseIntent(baseInput);

      expect(result.intent).toBeNull();
      expect(result.clarification).toContain("source token");
      expect(result.clarification).toContain("target token");
      expect(result.clarification).toContain("amount");
    });

    it("asks user to be specific when both intent and clarification are null", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "Cannot determine user intent",
        intent: null,
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        memoryIndicator: null,
      }));

      const result = await parseIntent(baseInput);

      expect(result.intent).toBeNull();
      expect(result.clarification).toContain("more specific");
    });
  });

  describe("parseIntent — unknown token handling", () => {
    it("returns error naming unrecognized fromToken", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "User wants to swap XYZZ token",
        intent: { action: "swap", fromToken: "XYZZ", toToken: "SUI", amount: 100 },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        memoryIndicator: null,
      }));

      const result = await parseIntent(baseInput);

      expect(result.intent).toBeNull();
      expect(result.clarification).toContain("XYZZ");
      expect(result.clarification).toContain("don't recognize");
    });

    it("returns error naming unrecognized toToken", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "User wants to swap to unknown token",
        intent: { action: "swap", fromToken: "USDC", toToken: "BONK", amount: 50 },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        memoryIndicator: null,
      }));

      const result = await parseIntent(baseInput);

      expect(result.intent).toBeNull();
      expect(result.clarification).toContain("BONK");
    });

    it("returns error for unrecognized stake token", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "User wants to stake unknown token",
        intent: { action: "stake", token: "ETH", amount: 10 },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        memoryIndicator: null,
      }));

      const result = await parseIntent(baseInput);

      expect(result.intent).toBeNull();
      expect(result.clarification).toContain("ETH");
    });
  });

  describe("parseIntent — risk flags extraction", () => {
    it("extracts slippage concern from LLM response", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "Large swap relative to pool",
        intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 10000 },
        clarification: null,
        riskFlags: { slippageConcern: true, concentrationConcern: false, rationale: "Large amount may cause slippage" },
        memoryIndicator: null,
      }));

      const result = await parseIntent(baseInput);

      expect(result.riskFlags.slippageConcern).toBe(true);
      expect(result.riskFlags.concentrationConcern).toBe(false);
      expect(result.riskFlags.rationale).toContain("slippage");
    });

    it("extracts concentration concern from LLM response", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "Swap would concentrate portfolio",
        intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 400 },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: true, rationale: "Would make SUI >70% of portfolio" },
        memoryIndicator: null,
      }));

      const result = await parseIntent(baseInput);

      expect(result.riskFlags.slippageConcern).toBe(false);
      expect(result.riskFlags.concentrationConcern).toBe(true);
      expect(result.riskFlags.rationale).toContain("70%");
    });

    it("defaults risk flags to false when missing from LLM response", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "Simple swap",
        intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 10 },
        clarification: null,
        riskFlags: {},
        memoryIndicator: null,
      }));

      const result = await parseIntent(baseInput);

      expect(result.riskFlags.slippageConcern).toBe(false);
      expect(result.riskFlags.concentrationConcern).toBe(false);
      expect(result.riskFlags.rationale).toBe("");
    });
  });

  describe("parseIntent — memory preferences", () => {
    it("applies DEX preference from memory when dex is not specified", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "Swap 100 USDC to SUI",
        intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 100 },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        memoryIndicator: null,
      }));

      const input: IntentParserInput = {
        ...baseInput,
        memories: [
          {
            id: "pref-1",
            type: "preference",
            content: "Preferred DEX: Cetus",
            timestamp: Date.now(),
          },
        ],
      };

      const result = await parseIntent(input);

      expect(result.intent).not.toBeNull();
      if (result.intent?.action === "swap") {
        expect(result.intent.dex).toBe("Cetus");
      }
      expect(result.memoryIndicator).toContain("Cetus");
      expect(result.memoryIndicator).toContain("preferred DEX");
    });

    it("does not override dex when already specified in intent", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "Swap via specific DEX",
        intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 100, dex: "Turbos" },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        memoryIndicator: null,
      }));

      const input: IntentParserInput = {
        ...baseInput,
        memories: [
          {
            id: "pref-1",
            type: "preference",
            content: "Preferred DEX: Cetus",
            timestamp: Date.now(),
          },
        ],
      };

      const result = await parseIntent(input);

      if (result.intent?.action === "swap") {
        expect(result.intent.dex).toBe("Turbos");
      }
    });

    it("does not apply DEX preference for stake intents", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "Stake SUI",
        intent: { action: "stake", token: "SUI", amount: 50 },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        memoryIndicator: null,
      }));

      const input: IntentParserInput = {
        ...baseInput,
        memories: [
          {
            id: "pref-1",
            type: "preference",
            content: "Preferred DEX: Cetus",
            timestamp: Date.now(),
          },
        ],
      };

      const result = await parseIntent(input);

      expect(result.intent?.action).toBe("stake");
      // Memory indicator should be null since DEX preference doesn't apply to stake
      expect(result.memoryIndicator).toBeNull();
    });

    it("handles memory with alternate DEX content format", async () => {
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        reasoning: "Swap",
        intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 100 },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        memoryIndicator: null,
      }));

      const input: IntentParserInput = {
        ...baseInput,
        memories: [
          {
            id: "pref-1",
            type: "preference",
            content: "User prefers Turbos as their DEX",
            timestamp: Date.now(),
          },
        ],
      };

      const result = await parseIntent(input);

      if (result.intent?.action === "swap") {
        expect(result.intent.dex).toBe("Turbos");
      }
      expect(result.memoryIndicator).toContain("Turbos");
    });
  });

  describe("parseIntent — malformed JSON handling", () => {
    it("returns clarification when LLM returns non-JSON text", async () => {
      mockCallLLM.mockResolvedValueOnce("Sorry, I cannot help with that.");

      const result = await parseIntent(baseInput);

      expect(result.intent).toBeNull();
      expect(result.clarification).toContain("rephrase");
    });

    it("handles JSON wrapped in markdown code fences", async () => {
      const json = JSON.stringify({
        reasoning: "Swap request",
        intent: { action: "swap", fromToken: "USDC", toToken: "SUI", amount: 100 },
        clarification: null,
        riskFlags: { slippageConcern: false, concentrationConcern: false, rationale: "" },
        memoryIndicator: null,
      });

      mockCallLLM.mockResolvedValueOnce(`\`\`\`json\n${json}\n\`\`\``);

      const result = await parseIntent(baseInput);

      expect(result.intent).not.toBeNull();
      expect(result.intent?.action).toBe("swap");
    });
  });

  describe("parseIntent — AppError re-throw", () => {
    it("re-throws LLM_TIMEOUT AppError from callLLM", async () => {
      const appError = {
        code: ErrorCode.LLM_TIMEOUT,
        message: "I couldn't process that in time. Please try again.",
        suggestion: "Try a simpler request",
      };
      mockCallLLM.mockRejectedValueOnce(appError);

      await expect(parseIntent(baseInput)).rejects.toMatchObject({
        code: ErrorCode.LLM_TIMEOUT,
      });
    });

    it("re-throws LLM_ERROR AppError from callLLM", async () => {
      const appError = {
        code: ErrorCode.LLM_ERROR,
        message: "I couldn't process that. Please try again.",
      };
      mockCallLLM.mockRejectedValueOnce(appError);

      await expect(parseIntent(baseInput)).rejects.toMatchObject({
        code: ErrorCode.LLM_ERROR,
      });
    });
  });

  describe("buildUnknownTokenError", () => {
    it("includes the unrecognized symbol in the output", () => {
      const result = buildUnknownTokenError("XYZZ");

      expect(result.intent).toBeNull();
      expect(result.clarification).toContain("XYZZ");
      expect(result.reasoning).toContain("XYZZ");
    });

    it("has safe default risk flags", () => {
      const result = buildUnknownTokenError("BONK");

      expect(result.riskFlags.slippageConcern).toBe(false);
      expect(result.riskFlags.concentrationConcern).toBe(false);
    });
  });
});

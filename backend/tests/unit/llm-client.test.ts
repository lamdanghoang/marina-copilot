import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildSystemPrompt,
  buildLLMContext,
  callLLM,
  resetBedrockClient,
  LLMContext,
} from "../../src/services/llm-client";
import { IntentParserInput, ErrorCode } from "../../src/types";

describe("llm-client", () => {
  describe("buildSystemPrompt", () => {
    it("returns a non-empty string with DeFi advisor role", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toBeTruthy();
      expect(prompt).toContain("DeFi financial advisor");
      expect(prompt).toContain("Sui blockchain");
    });

    it("includes available actions (swap and stake)", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("swap");
      expect(prompt).toContain("stake");
    });

    it("includes supported tokens", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("SUI");
      expect(prompt).toContain("USDC");
      expect(prompt).toContain("USDT");
    });

    it("includes JSON output schema", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("reasoning");
      expect(prompt).toContain("intent");
      expect(prompt).toContain("clarification");
      expect(prompt).toContain("riskFlags");
      expect(prompt).toContain("memoryIndicator");
    });

    it("includes rules about not guessing amounts or tokens", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("NEVER guess amounts");
      expect(prompt).toContain("NEVER guess token symbols");
    });

    it("instructs to return intent=null when uncertain", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("intent=null");
    });
  });

  describe("buildLLMContext", () => {
    const baseInput: IntentParserInput = {
      message: "Swap 100 USDC to SUI",
      memories: [],
      balances: [],
      conversationHistory: [],
    };

    it("produces a valid LLMContext with all required fields", () => {
      const context = buildLLMContext(baseInput);
      expect(context.systemPrompt).toBeTruthy();
      expect(context.userMessage).toBe("Swap 100 USDC to SUI");
      expect(context.memories).toEqual([]);
      expect(context.balances).toContain("No balance data");
      expect(context.conversationHistory).toEqual([]);
    });

    it("formats memories with type prefix", () => {
      const input: IntentParserInput = {
        ...baseInput,
        memories: [
          {
            id: "1",
            type: "preference",
            content: "Preferred DEX: Cetus",
            timestamp: Date.now(),
          },
          {
            id: "2",
            type: "transaction",
            content: "Swapped 50 USDC to SUI",
            timestamp: Date.now(),
          },
        ],
      };

      const context = buildLLMContext(input);
      expect(context.memories).toHaveLength(2);
      expect(context.memories[0]).toBe("[Preference] Preferred DEX: Cetus");
      expect(context.memories[1]).toBe("[History] Swapped 50 USDC to SUI");
    });

    it("limits memories to 10 entries", () => {
      const input: IntentParserInput = {
        ...baseInput,
        memories: Array.from({ length: 15 }, (_, i) => ({
          id: String(i),
          type: "transaction" as const,
          content: `Memory ${i}`,
          timestamp: Date.now(),
        })),
      };

      const context = buildLLMContext(input);
      expect(context.memories).toHaveLength(10);
    });

    it("formats balances with token symbols and amounts", () => {
      const input: IntentParserInput = {
        ...baseInput,
        balances: [
          { token: "0x2::sui::SUI", symbol: "SUI", balance: 100, decimals: 9, valueUsd: 120.5 },
          { token: "0x...::usdc::USDC", symbol: "USDC", balance: 500, decimals: 6, valueUsd: 500 },
        ],
      };

      const context = buildLLMContext(input);
      expect(context.balances).toContain("SUI: 100");
      expect(context.balances).toContain("~$120.50");
      expect(context.balances).toContain("USDC: 500");
      expect(context.balances).toContain("~$500.00");
    });

    it("limits conversation history to last 6 messages", () => {
      const input: IntentParserInput = {
        ...baseInput,
        conversationHistory: Array.from({ length: 10 }, (_, i) => ({
          id: String(i),
          role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
          content: `Message ${i}`,
          type: "text" as const,
          timestamp: Date.now(),
        })),
      };

      const context = buildLLMContext(input);
      expect(context.conversationHistory).toHaveLength(6);
    });
  });

  describe("callLLM", () => {
    const mockSend = vi.fn();

    beforeEach(() => {
      // Inject a mock Bedrock client
      resetBedrockClient({ send: mockSend } as unknown as import("@aws-sdk/client-bedrock-runtime").BedrockRuntimeClient);
    });

    afterEach(() => {
      resetBedrockClient();
      vi.restoreAllMocks();
    });

    const sampleContext: LLMContext = {
      systemPrompt: "You are a test assistant.",
      userMessage: "Swap 100 USDC to SUI",
      memories: [],
      balances: "SUI: 50",
      conversationHistory: [],
    };

    it("returns text content from a successful LLM response", async () => {
      const responseText = '{"reasoning":"test","intent":null,"clarification":"What token?","riskFlags":{"slippageConcern":false,"concentrationConcern":false,"rationale":"N/A"},"memoryIndicator":null}';

      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [{ type: "text", text: responseText }],
          })
        ),
      });

      const result = await callLLM(sampleContext);
      expect(result).toBe(responseText);
      expect(result).toContain("reasoning");
      expect(result).toContain("clarification");
    });

    it("throws LLM_TIMEOUT when request times out", async () => {
      mockSend.mockImplementationOnce(
        (_cmd: unknown, options: { abortSignal: AbortSignal }) => {
          return new Promise((_, reject) => {
            if (options?.abortSignal) {
              options.abortSignal.addEventListener("abort", () => {
                const err = new Error("The operation was aborted");
                err.name = "AbortError";
                reject(err);
              });
            }
          });
        }
      );

      try {
        await callLLM(sampleContext);
        expect.fail("Should have thrown");
      } catch (err: unknown) {
        const appErr = err as { code: string; message: string };
        expect(appErr.code).toBe(ErrorCode.LLM_TIMEOUT);
        expect(appErr.message).toContain("couldn't process that in time");
      }
    }, 15000);

    it("throws LLM_ERROR when response has no text content", async () => {
      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(
          JSON.stringify({ content: [] })
        ),
      });

      try {
        await callLLM(sampleContext);
        expect.fail("Should have thrown");
      } catch (err: unknown) {
        const appErr = err as { code: string; message: string };
        expect(appErr.code).toBe(ErrorCode.LLM_ERROR);
        expect(appErr.message).toContain("couldn't process that");
      }
    });

    it("throws LLM_ERROR for generic AWS errors", async () => {
      mockSend.mockRejectedValueOnce(new Error("Service unavailable"));

      try {
        await callLLM(sampleContext);
        expect.fail("Should have thrown");
      } catch (err: unknown) {
        const appErr = err as { code: string; message: string; suggestion?: string };
        expect(appErr.code).toBe(ErrorCode.LLM_ERROR);
        expect(appErr.message).toContain("couldn't process that");
        expect(appErr.suggestion).toContain("rephrasing");
      }
    });
  });
});

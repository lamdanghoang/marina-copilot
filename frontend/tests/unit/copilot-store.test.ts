import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCopilotStore } from "@/store/copilot-store";

// Mock the API client
vi.mock("@/lib/api-client", () => ({
  processIntent: vi.fn(),
}));

import { processIntent } from "@/lib/api-client";

const mockProcessIntent = vi.mocked(processIntent);

describe("CopilotStore", () => {
  beforeEach(() => {
    // Reset the store between tests
    useCopilotStore.setState({
      walletAddress: null,
      balances: [],
      messages: [],
      isProcessing: false,
      statusText: "",
      currentPreview: null,
    });
    vi.clearAllMocks();
  });

  describe("connectWallet", () => {
    it("should set wallet address and balances", () => {
      const balances = [
        { token: "0x2::sui::SUI", symbol: "SUI", balance: 100, decimals: 9 },
      ];

      useCopilotStore.getState().connectWallet("0x1a2b3c4d", balances);

      const state = useCopilotStore.getState();
      expect(state.walletAddress).toBe("0x1a2b3c4d");
      expect(state.balances).toEqual(balances);
    });
  });

  describe("disconnectWallet", () => {
    it("should clear wallet state and messages", () => {
      useCopilotStore.setState({
        walletAddress: "0x1234",
        balances: [{ token: "0x2::sui::SUI", symbol: "SUI", balance: 50, decimals: 9 }],
        messages: [
          { id: "1", role: "user", content: "hello", type: "text", timestamp: 1 },
        ],
        currentPreview: {
          steps: [],
          metadata: { type: "swap", steps: [], gasEstimate: 0.01 },
          risks: [],
          assessment: "safe",
          transactionBytes: "abc",
        },
        isProcessing: true,
        statusText: "Processing...",
      });

      useCopilotStore.getState().disconnectWallet();

      const state = useCopilotStore.getState();
      expect(state.walletAddress).toBeNull();
      expect(state.balances).toEqual([]);
      expect(state.messages).toEqual([]);
      expect(state.currentPreview).toBeNull();
      expect(state.isProcessing).toBe(false);
      expect(state.statusText).toBe("");
    });
  });

  describe("cancelPreview", () => {
    it("should clear preview and processing state", () => {
      useCopilotStore.setState({
        currentPreview: {
          steps: [{ index: 1, description: "Swap 100 USDC → SUI", type: "swap" }],
          metadata: { type: "swap", steps: [], gasEstimate: 0.01 },
          risks: [],
          assessment: "safe",
          transactionBytes: "base64data",
        },
        isProcessing: true,
        statusText: "Awaiting confirmation...",
      });

      useCopilotStore.getState().cancelPreview();

      const state = useCopilotStore.getState();
      expect(state.currentPreview).toBeNull();
      expect(state.isProcessing).toBe(false);
      expect(state.statusText).toBe("");
    });
  });

  describe("sendMessage", () => {
    it("should not send message when wallet is not connected", async () => {
      await useCopilotStore.getState().sendMessage("swap 100 USDC to SUI");

      const state = useCopilotStore.getState();
      expect(state.messages).toEqual([]);
      expect(mockProcessIntent).not.toHaveBeenCalled();
    });

    it("should add user message and call API", async () => {
      useCopilotStore.setState({
        walletAddress: "0xabc123",
        balances: [{ token: "0x2::sui::SUI", symbol: "SUI", balance: 100, decimals: 9 }],
      });

      mockProcessIntent.mockResolvedValueOnce({
        type: "clarification",
        clarification: { message: "Which DEX would you like to use?" },
      });

      await useCopilotStore.getState().sendMessage("swap 100 USDC to SUI");

      const state = useCopilotStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].role).toBe("user");
      expect(state.messages[0].content).toBe("swap 100 USDC to SUI");
      expect(state.messages[1].role).toBe("assistant");
      expect(state.messages[1].type).toBe("clarification");
      expect(state.isProcessing).toBe(false);
    });

    it("should set currentPreview when API returns preview", async () => {
      useCopilotStore.setState({
        walletAddress: "0xabc123",
        balances: [],
      });

      const preview = {
        steps: [{ index: 1, description: "Swap 100 USDC → ~24.8 SUI via Cetus", type: "swap" as const }],
        metadata: {
          type: "swap" as const,
          steps: [{ index: 1, description: "Swap 100 USDC → ~24.8 SUI via Cetus", type: "swap" as const }],
          gasEstimate: 0.005,
          route: ["USDC", "SUI"],
          exchangeRate: 0.248,
          estimatedOutput: 24.8,
          minimumOutput: 24.552,
          priceImpact: 0.3,
        },
        risks: [],
        assessment: "safe" as const,
        transactionBytes: "base64txbytes",
      };

      mockProcessIntent.mockResolvedValueOnce({
        type: "preview",
        preview,
      });

      await useCopilotStore.getState().sendMessage("swap 100 USDC to SUI");

      const state = useCopilotStore.getState();
      expect(state.currentPreview).toEqual(preview);
      expect(state.messages[1].type).toBe("preview");
    });

    it("should handle API errors gracefully", async () => {
      useCopilotStore.setState({
        walletAddress: "0xabc123",
        balances: [],
      });

      mockProcessIntent.mockRejectedValueOnce(new Error("Network error"));

      await useCopilotStore.getState().sendMessage("swap 100 USDC to SUI");

      const state = useCopilotStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[1].type).toBe("error");
      expect(state.messages[1].content).toBe("I couldn't process that. Please try again.");
      expect(state.isProcessing).toBe(false);
    });

    it("should include conversation history in API request", async () => {
      useCopilotStore.setState({
        walletAddress: "0xabc123",
        balances: [{ token: "0x2::sui::SUI", symbol: "SUI", balance: 50, decimals: 9 }],
        messages: [
          { id: "prev1", role: "user", content: "hello", type: "text", timestamp: 1000 },
          { id: "prev2", role: "assistant", content: "Hi! How can I help?", type: "text", timestamp: 1001 },
        ],
      });

      mockProcessIntent.mockResolvedValueOnce({
        type: "clarification",
        clarification: { message: "How much?" },
      });

      await useCopilotStore.getState().sendMessage("swap USDC to SUI");

      expect(mockProcessIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "swap USDC to SUI",
          walletAddress: "0xabc123",
          conversationHistory: expect.arrayContaining([
            expect.objectContaining({ content: "hello" }),
            expect.objectContaining({ content: "Hi! How can I help?" }),
            expect.objectContaining({ content: "swap USDC to SUI" }),
          ]),
        })
      );
    });
  });

  describe("confirmTransaction", () => {
    it("should not do anything when no preview exists", async () => {
      useCopilotStore.setState({ currentPreview: null });

      await useCopilotStore.getState().confirmTransaction();

      const state = useCopilotStore.getState();
      expect(state.isProcessing).toBe(false);
    });

    it("should be a no-op (execution handled by useTransactionExecution hook)", async () => {
      useCopilotStore.setState({
        currentPreview: {
          steps: [{ index: 1, description: "Swap", type: "swap" }],
          metadata: { type: "swap", steps: [], gasEstimate: 0.01 },
          risks: [],
          assessment: "safe",
          transactionBytes: "base64data",
        },
      });

      await useCopilotStore.getState().confirmTransaction();

      const state = useCopilotStore.getState();
      // confirmTransaction is now a no-op in the store — real execution is in the hook
      expect(state.currentPreview).not.toBeNull();
      expect(state.isProcessing).toBe(false);
    });
  });
});

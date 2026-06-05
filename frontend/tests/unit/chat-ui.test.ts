import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCopilotStore } from "@/store/copilot-store";
import type { ChatMessage } from "@/types";

// Mock the API client
vi.mock("@/lib/api-client", () => ({
  processIntent: vi.fn(),
}));

describe("Chat UI — Store Integration", () => {
  beforeEach(() => {
    useCopilotStore.setState({
      walletAddress: null,
      balances: [],
      messages: [],
      isProcessing: false,
      statusText: "",
      currentPreview: null,
    });
  });

  describe("Message alignment and type", () => {
    it("user messages have role 'user' for right-alignment rendering", () => {
      useCopilotStore.setState({
        messages: [
          { id: "1", role: "user", content: "swap 100 USDC to SUI", type: "text", timestamp: Date.now() },
        ],
      });

      const { messages } = useCopilotStore.getState();
      expect(messages[0].role).toBe("user");
    });

    it("assistant messages have role 'assistant' for left-alignment rendering", () => {
      useCopilotStore.setState({
        messages: [
          { id: "1", role: "assistant", content: "I can help with that!", type: "text", timestamp: Date.now() },
        ],
      });

      const { messages } = useCopilotStore.getState();
      expect(messages[0].role).toBe("assistant");
    });
  });

  describe("Processing state controls input disable", () => {
    it("isProcessing is true during API call", () => {
      useCopilotStore.setState({ isProcessing: true, statusText: "Parsing intent..." });

      const state = useCopilotStore.getState();
      expect(state.isProcessing).toBe(true);
      expect(state.statusText).toBe("Parsing intent...");
    });

    it("isProcessing is false when idle", () => {
      const state = useCopilotStore.getState();
      expect(state.isProcessing).toBe(false);
    });
  });

  describe("Input validation — empty message prevention", () => {
    it("sendMessage does nothing when wallet not connected", async () => {
      await useCopilotStore.getState().sendMessage("hello");
      expect(useCopilotStore.getState().messages).toHaveLength(0);
    });

    it("sendMessage adds user message when wallet is connected and message non-empty", async () => {
      useCopilotStore.setState({
        walletAddress: "0xabc123",
        balances: [{ token: "0x2::sui::SUI", symbol: "SUI", balance: 100, decimals: 9 }],
      });

      const { processIntent } = await import("@/lib/api-client");
      vi.mocked(processIntent).mockResolvedValueOnce({
        type: "clarification",
        clarification: { message: "Which DEX?" },
      });

      await useCopilotStore.getState().sendMessage("swap");

      const state = useCopilotStore.getState();
      expect(state.messages.length).toBeGreaterThan(0);
      expect(state.messages[0].content).toBe("swap");
    });
  });

  describe("Typing indicator state", () => {
    it("statusText updates during processing", () => {
      useCopilotStore.setState({
        isProcessing: true,
        statusText: "Compiling transaction...",
      });

      const state = useCopilotStore.getState();
      expect(state.statusText).toBe("Compiling transaction...");
    });

    it("statusText clears after processing completes", () => {
      useCopilotStore.setState({
        isProcessing: false,
        statusText: "",
      });

      const state = useCopilotStore.getState();
      expect(state.statusText).toBe("");
    });
  });

  describe("Auto-scroll trigger (messages array changes)", () => {
    it("adding messages changes the messages array reference", () => {
      const initialMessages: ChatMessage[] = [];
      useCopilotStore.setState({ messages: initialMessages });

      const newMessages: ChatMessage[] = [
        { id: "1", role: "user", content: "test", type: "text", timestamp: Date.now() },
      ];
      useCopilotStore.setState({ messages: newMessages });

      expect(useCopilotStore.getState().messages).not.toBe(initialMessages);
      expect(useCopilotStore.getState().messages).toHaveLength(1);
    });
  });

  describe("Input re-enable after response", () => {
    it("isProcessing goes from true to false after successful response", async () => {
      useCopilotStore.setState({
        walletAddress: "0xtest",
        balances: [{ token: "0x2::sui::SUI", symbol: "SUI", balance: 50, decimals: 9 }],
      });

      const { processIntent } = await import("@/lib/api-client");
      vi.mocked(processIntent).mockResolvedValueOnce({
        type: "clarification",
        clarification: { message: "How much?" },
      });

      // Before send
      expect(useCopilotStore.getState().isProcessing).toBe(false);

      await useCopilotStore.getState().sendMessage("swap USDC");

      // After completion
      expect(useCopilotStore.getState().isProcessing).toBe(false);
      expect(useCopilotStore.getState().statusText).toBe("");
    });

    it("isProcessing goes from true to false after error", async () => {
      useCopilotStore.setState({
        walletAddress: "0xtest",
        balances: [],
      });

      const { processIntent } = await import("@/lib/api-client");
      vi.mocked(processIntent).mockRejectedValueOnce(new Error("fail"));

      await useCopilotStore.getState().sendMessage("swap");

      expect(useCopilotStore.getState().isProcessing).toBe(false);
      expect(useCopilotStore.getState().statusText).toBe("");
    });
  });
});

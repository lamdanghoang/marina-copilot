import { create } from "zustand";
import {
  ChatMessage,
  TokenBalance,
  ProcessIntentResponse,
} from "@/types";
import { processIntent } from "@/lib/api-client";

interface CopilotStore {
  // Wallet
  walletAddress: string | null;
  balances: TokenBalance[];

  // Chat
  messages: ChatMessage[];
  isProcessing: boolean;
  statusText: string;

  // Preview
  currentPreview: ProcessIntentResponse["preview"] | null;

  // Actions
  sendMessage(message: string): Promise<void>;
  confirmTransaction(): Promise<void>;
  cancelPreview(): void;
  connectWallet(address: string, balances: TokenBalance[]): void;
  disconnectWallet(): void;
}

export const useCopilotStore = create<CopilotStore>((set, get) => ({
  // Initial state
  walletAddress: null,
  balances: [],
  messages: [],
  isProcessing: false,
  statusText: "",
  currentPreview: null,

  sendMessage: async (message: string) => {
    const { walletAddress, balances, messages } = get();

    if (!walletAddress) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      type: "text",
      timestamp: Date.now(),
    };

    set({
      messages: [...messages, userMessage],
      isProcessing: true,
      statusText: "Parsing intent...",
    });

    try {
      set({ statusText: "Processing..." });

      const response = await processIntent({
        message,
        walletAddress,
        conversationHistory: [...messages, userMessage],
        balances,
      });

      const assistantMessage = buildAssistantMessage(response);

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isProcessing: false,
        statusText: "",
        currentPreview: response.type === "preview" ? response.preview ?? null : null,
      }));
    } catch {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I couldn't process that. Please try again.",
        type: "error",
        timestamp: Date.now(),
      };

      set((state) => ({
        messages: [...state.messages, errorMessage],
        isProcessing: false,
        statusText: "",
      }));
    }
  },

  confirmTransaction: async () => {
    const { currentPreview } = get();

    if (!currentPreview?.transactionBytes) return;

    set({ isProcessing: true, statusText: "Awaiting wallet signature..." });

    try {
      // Placeholder: In actual implementation, this will:
      // 1. Deserialize transactionBytes from base64
      // 2. Call signAndExecuteTransaction via @mysten/dapp-kit
      // 3. Handle the result
      // For now, this is a stub that the transaction execution task will fill in.

      set({ statusText: "Submitting to network..." });

      // TODO: Implement actual wallet signing in task 11.1
      throw new Error("Transaction signing not yet implemented");
    } catch {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Transaction was cancelled.",
        type: "error",
        timestamp: Date.now(),
      };

      set((state) => ({
        messages: [...state.messages, errorMessage],
        isProcessing: false,
        statusText: "",
        currentPreview: null,
      }));
    }
  },

  cancelPreview: () => {
    set({
      currentPreview: null,
      isProcessing: false,
      statusText: "",
    });
  },

  connectWallet: (address: string, balances: TokenBalance[]) => {
    set({
      walletAddress: address,
      balances,
    });
  },

  disconnectWallet: () => {
    set({
      walletAddress: null,
      balances: [],
      messages: [],
      currentPreview: null,
      isProcessing: false,
      statusText: "",
    });
  },
}));

function buildAssistantMessage(response: ProcessIntentResponse): ChatMessage {
  switch (response.type) {
    case "clarification":
      return {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.clarification?.message ?? "Could you clarify?",
        type: "clarification",
        timestamp: Date.now(),
      };

    case "preview":
      return {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Here's what I'll do:",
        type: "preview",
        timestamp: Date.now(),
      };

    case "error":
      return {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.error?.message ?? "Something went wrong.",
        type: "error",
        timestamp: Date.now(),
        metadata: {
          memoryIndicator: response.error?.suggestion,
        },
      };

    default:
      return {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Something unexpected happened.",
        type: "error",
        timestamp: Date.now(),
      };
  }
}

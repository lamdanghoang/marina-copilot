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
    // This is now a no-op in the store.
    // Transaction execution is handled by the useTransactionExecution hook
    // which has access to wallet signing via @mysten/dapp-kit.
    // The hook calls useCopilotStore.setState directly.
    // This method is kept for interface compatibility.
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

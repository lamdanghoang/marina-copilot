import { create } from "zustand";
import {
  ChatMessage,
  TokenBalance,
  ProcessIntentResponse,
  MemwalCredentials,
  OnChainCapsule,
} from "@/types";
import { processIntent, remember } from "@/lib/api-client";

interface CopilotStore {
  // Wallet
  walletAddress: string | null;
  balances: TokenBalance[];
  capsules: OnChainCapsule[];

  // Memory
  memwalCredentials: MemwalCredentials | null;

  // Chat
  messages: ChatMessage[];
  isProcessing: boolean;
  statusText: string;

  // Preview
  currentPreview: ProcessIntentResponse["preview"] | null;

  // Pending action (capsule/file) for frontend execution
  pendingAction: ProcessIntentResponse["actionRequest"] | null;
  pendingFile: File | null;

  // Actions
  sendMessage(message: string): Promise<void>;
  confirmTransaction(): Promise<void>;
  cancelPreview(): void;
  clearHistory(): void;
  connectWallet(address: string, balances: TokenBalance[]): void;
  disconnectWallet(): void;
  setMemwalCredentials(creds: MemwalCredentials | null): void;
}

// --- Chat persistence helpers ---
const CHAT_STORAGE_PREFIX = "marina-copilot-chat-";

function getChatKey(walletAddress: string | null): string {
  return walletAddress ? `${CHAT_STORAGE_PREFIX}${walletAddress}` : `${CHAT_STORAGE_PREFIX}default`;
}

function loadMessages(walletAddress?: string | null): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getChatKey(walletAddress ?? null));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveMessages(messages: ChatMessage[], walletAddress?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getChatKey(walletAddress ?? null), JSON.stringify(messages.slice(-50)));
  } catch { /* quota exceeded */ }
}

/** Build a short summary of recent chat for MemWal storage */
function buildChatSummary(messages: ChatMessage[]): string | null {
  const recent = messages.slice(-20);
  if (recent.length < 2) return null;

  const lines = recent
    .filter((m) => m.type !== "preview")
    .map((m) => `${m.role === "user" ? "User" : "Marina"}: ${m.content.slice(0, 100)}`)
    .slice(-10);

  return `Chat session summary:\n${lines.join("\n")}`;
}

/** Save chat summary to MemWal (fire-and-forget) */
function saveChatSummaryToMemwal(walletAddress: string | null, messages: ChatMessage[], creds: MemwalCredentials | null): void {
  if (!walletAddress || messages.length < 2) return;
  const summary = buildChatSummary(messages);
  if (!summary) return;

  remember(walletAddress, { type: "transaction", content: summary, metadata: { action: "chat_summary" } }, creds ?? undefined).catch(() => {});
}

export const useCopilotStore = create<CopilotStore>((set, get) => {
  // Save chat summary on page unload
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      const { walletAddress, messages, memwalCredentials } = get();
      saveChatSummaryToMemwal(walletAddress, messages, memwalCredentials);
    });
  }

  return {
  // Initial state
  walletAddress: null,
  balances: [],
  capsules: [],
  memwalCredentials: null,
  messages: [],
  isProcessing: false,
  statusText: "",
  currentPreview: null,
  pendingAction: null,
  pendingFile: null,

  sendMessage: async (message: string) => {
    const { walletAddress, balances, messages, memwalCredentials } = get();

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
      statusText: "Thinking...",
    });
    saveMessages([...messages, userMessage], get().walletAddress);

    // Only show transaction-related status for non-query messages
    const isLikelyQuery = /balance|history|portfolio|how much/i.test(message);
    const statusTimers: ReturnType<typeof setTimeout>[] = [];
    if (!isLikelyQuery) {
      statusTimers.push(
        setTimeout(() => set({ statusText: "Compiling transaction..." }), 4000)
      );
      statusTimers.push(
        setTimeout(() => set({ statusText: "Checking risks..." }), 6000)
      );
    }

    try {
      const contacts = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("marina-copilot-contacts") || "[]") : [];
      const pendingFile = get().pendingFile;
      const messageWithFileContext = pendingFile
        ? `${message}\n[Attached file: ${pendingFile.name} (${(pendingFile.size / 1024).toFixed(1)} KB)]`
        : message;
      const response = await processIntent({
        message: messageWithFileContext,
        walletAddress,
        conversationHistory: [...messages, userMessage],
        balances,
        memwalCredentials: memwalCredentials ?? undefined,
        contacts,
      });

      // Clear status timers on response
      statusTimers.forEach(clearTimeout);

      const assistantMessage = buildAssistantMessage(response);

      set((state) => {
        const newMessages = [...state.messages, assistantMessage];
        saveMessages(newMessages, get().walletAddress);
        return {
          messages: newMessages,
          isProcessing: false,
          statusText: "",
          currentPreview: response.type === "preview" ? response.preview ?? null : null,
          pendingAction: response.type === "action_request" ? response.actionRequest ?? null : null,
        };
      });
    } catch (error: unknown) {
      // Clear status timers on error
      statusTimers.forEach(clearTimeout);

      // Build user-friendly error message from API client error
      let errorContent = "I couldn't process that. Please try again.";
      let suggestion: string | undefined;

      if (error && typeof error === "object" && "message" in error) {
        const apiError = error as { message?: string; isTimeout?: boolean; isNetworkError?: boolean; status?: number };
        if (apiError.isTimeout) {
          errorContent = "The request timed out. Please try again.";
          suggestion = "If this keeps happening, try a simpler request.";
        } else if (apiError.isNetworkError) {
          errorContent = "Couldn't reach the server. Please check your connection and try again.";
        } else if (apiError.status && apiError.status >= 500) {
          errorContent = "Something went wrong on our end. Please try again in a moment.";
          suggestion = "If this keeps happening, try rephrasing your request.";
        } else if (apiError.message) {
          errorContent = apiError.message;
        }
      }

      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: errorContent,
        type: "error",
        timestamp: Date.now(),
        ...(suggestion ? { metadata: { memoryIndicator: suggestion } } : {}),
      };

      set((state) => {
        const newMessages = [...state.messages, errorMessage];
        saveMessages(newMessages, get().walletAddress);
        return {
          messages: newMessages,
          isProcessing: false,
          statusText: "",
        };
      });
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
    set((state) => {
      const messages = state.messages.filter((m) => !(m.type === "preview" && m.role === "assistant"));
      saveMessages(messages, get().walletAddress);
      return { currentPreview: null, isProcessing: false, statusText: "", messages };
    });
  },

  clearHistory: () => {
    saveMessages([], get().walletAddress);
    set({ messages: [], currentPreview: null });
  },

  connectWallet: (address: string, balances: TokenBalance[]) => {
    const currentAddress = get().walletAddress;
    // Load chat for this wallet if switching
    const messages = currentAddress !== address ? loadMessages(address) : get().messages;
    set({
      walletAddress: address,
      balances,
      messages,
    });
  },

  disconnectWallet: () => {
    const { walletAddress, messages, memwalCredentials } = get();
    saveChatSummaryToMemwal(walletAddress, messages, memwalCredentials);
    set({
      walletAddress: null,
      balances: [],
      memwalCredentials: null,
      currentPreview: null,
      isProcessing: false,
      statusText: "",
    });
  },

  setMemwalCredentials: (creds: MemwalCredentials | null) => {
    set({ memwalCredentials: creds });
  },
}});

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

    case "info":
      return {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.info?.message ?? "Here's what I found.",
        type: "text",
        timestamp: Date.now(),
      };

    case "action_request":
      return {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.actionRequest?.message ?? "I'll help you with that.",
        type: "text",
        timestamp: Date.now(),
        metadata: {
          memoryIndicator: `Action: ${response.actionRequest?.action}`,
        },
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

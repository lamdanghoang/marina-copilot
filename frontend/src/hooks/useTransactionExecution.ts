"use client";

import { useCallback } from "react";
import { useDAppKit, useCurrentClient } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { useCopilotStore, saveMessages } from "@/store/copilot-store";
import { remember } from "@/lib/api-client";
import { formatBalance } from "@/lib/formatting";
import type { ChatMessage, TransactionMetadata } from "@/types";

const TX_TIMEOUT_MS = 60_000;

/**
 * Truncates a transaction digest to first 8 + last 4 characters.
 * e.g. "7f3a1b2c4d5e6f7890abcdef" → "7f3a1b2c...cdef"
 */
export function truncateDigest(digest: string): string {
  if (!digest || digest.length < 12) return digest;
  return `${digest.slice(0, 8)}...${digest.slice(-4)}`;
}

/**
 * Builds a Sui Explorer URL for a transaction digest on testnet.
 */
export function buildExplorerUrl(digest: string): string {
  return `https://suiscan.xyz/mainnet/tx/${digest}`;
}

/**
 * Builds an action summary string from transaction metadata.
 */
export function buildActionSummary(metadata: TransactionMetadata): string {
  if (metadata.type === "swap") {
    const swapStep = metadata.steps.find((s) => s.type === "swap");
    return swapStep?.description ?? "Swap completed";
  }
  if (metadata.type === "stake") {
    const stakeStep = metadata.steps.find((s) => s.type === "stake");
    return stakeStep?.description ?? `Staked SUI with ${metadata.validatorName ?? "validator"}`;
  }
  return "Transaction completed";
}

/**
 * Parses an on-chain transaction error into a plain-language message.
 */
function parseOnChainError(error: unknown): { message: string; suggestion: string } {
  const errorStr = error instanceof Error ? error.message : String(error);

  if (errorStr.includes("InsufficientGas") || errorStr.includes("insufficient gas")) {
    return {
      message: "Transaction failed due to insufficient gas.",
      suggestion: "Try keeping a bit more SUI in your wallet for gas fees.",
    };
  }

  if (errorStr.includes("InsufficientCoinBalance") || errorStr.includes("balance")) {
    return {
      message: "Transaction failed due to insufficient balance.",
      suggestion: "Check your token balance and try a smaller amount.",
    };
  }

  if (errorStr.includes("Slippage") || errorStr.includes("slippage")) {
    return {
      message: "Swap failed because the price moved too much.",
      suggestion: "Try again or increase your slippage tolerance.",
    };
  }

  return {
    message: "Transaction failed on-chain.",
    suggestion: "Please try again or adjust the transaction parameters.",
  };
}

/**
 * Checks if an error is a wallet rejection (user cancelled).
 */
function isWalletRejection(error: unknown): boolean {
  const errorStr = error instanceof Error ? error.message : String(error);
  const rejectionPhrases = [
    "cancelled",
    "canceled",
    "rejected",
    "user rejected",
    "user denied",
    "denied by user",
  ];
  return rejectionPhrases.some((phrase) =>
    errorStr.toLowerCase().includes(phrase)
  );
}

/**
 * Hook that provides the full transaction execution flow:
 * deserialize → sign → execute → handle result → remember
 */
export function useTransactionExecution() {
  const { signAndExecuteTransaction } =
    useDAppKit();
  const suiClient = useCurrentClient();

  const executeTransaction = useCallback(async () => {
    const store = useCopilotStore.getState();
    const { currentPreview, walletAddress } = store;

    if (!currentPreview?.transactionBytes || !walletAddress) return;

    const metadata = currentPreview.metadata;

    // Phase 1: Signing
    useCopilotStore.setState({
      isProcessing: true,
      statusText: "Awaiting wallet signature...",
    });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      // Deserialize transaction bytes from base64
      const bytes = Uint8Array.from(
        atob(currentPreview.transactionBytes),
        (c) => c.charCodeAt(0)
      );
      const tx = Transaction.from(bytes);

      // Phase 2: Submitting
      useCopilotStore.setState({ statusText: "Submitting to network..." });

      // Create a timeout race
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("TX_TIMEOUT"));
        }, TX_TIMEOUT_MS);
      });

      // Execute transaction with timeout
      // Use type assertion to handle potential version mismatch between
      // @mysten/sui and @mysten/dapp-kit's bundled @mysten/sui
      const result = await Promise.race([
        signAndExecuteTransaction({
          transaction: tx as unknown as Parameters<typeof signAndExecuteTransaction>[0]["transaction"],
        }),
        timeoutPromise,
      ]);

      // Clear timeout on success
      if (timeoutId) clearTimeout(timeoutId);

      // Phase 3: Confirmed
      useCopilotStore.setState({ statusText: "Confirming..." });

      const digest = (result as any)?.Transaction?.digest ?? (result as any)?.digest ?? "";
      const truncated = truncateDigest(digest);
      const explorerUrl = buildExplorerUrl(digest);
      const actionSummary = buildActionSummary(metadata);

      const successMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `✅ ${actionSummary}`,
        type: "success",
        timestamp: Date.now(),
        metadata: {
          txDigest: digest,
          explorerUrl,
        },
      };

      useCopilotStore.setState((state) => {
        // Remove "Here's what I'll do:" preview message + add success
        const filtered = state.messages.filter((m) => !(m.type === "preview" && m.role === "assistant"));
        const newMessages = [...filtered, successMessage];
        saveMessages(newMessages, state.walletAddress);
        return {
          messages: newMessages,
          isProcessing: false,
          statusText: "",
          currentPreview: null,
        };
      });

      // Trigger memory store (fire and forget — silent on failure per req 8.6)
      try {
        const memoryContent = buildMemoryContent(metadata, digest);
        const { memwalCredentials } = useCopilotStore.getState();
        await remember(walletAddress, memoryContent, memwalCredentials ?? undefined);
      } catch {
        // Silent degradation: memory store failure doesn't affect success display
        console.warn("Failed to store transaction memory");
      }

      // Refetch balance after successful tx
      try {
        const balanceResult = await (suiClient as any).getBalance({ owner: walletAddress });
        const rawBalance = BigInt(balanceResult.totalBalance);
        const formattedBalance = Number(formatBalance(rawBalance, 9, 2));
        useCopilotStore.getState().connectWallet(walletAddress, [
          { token: "0x2::sui::SUI", symbol: "SUI", balance: formattedBalance, decimals: 9 },
        ]);
      } catch {
        // Non-critical: balance will refresh on next page load
      }
    } catch (error) {
      // Clear timeout if still pending
      if (timeoutId) clearTimeout(timeoutId);

      // Handle timeout
      if (error instanceof Error && error.message === "TX_TIMEOUT") {
        const timeoutMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "⏱️ Couldn't confirm the transaction in time. It may still succeed — check Sui Explorer for the latest status.",
          type: "error",
          timestamp: Date.now(),
        };

        useCopilotStore.setState((state) => ({
          messages: [...state.messages, timeoutMessage],
          isProcessing: false,
          statusText: "",
          currentPreview: null,
        }));
        return;
      }

      // Handle wallet rejection
      if (isWalletRejection(error)) {
        const cancelMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Transaction cancelled. No changes were made.",
          type: "error",
          timestamp: Date.now(),
        };

        useCopilotStore.setState((state) => ({
          messages: [...state.messages, cancelMessage],
          isProcessing: false,
          statusText: "",
          currentPreview: null,
        }));
        return;
      }

      // Handle on-chain failure
      const { message, suggestion } = parseOnChainError(error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ ${message}\n\n💡 ${suggestion}`,
        type: "error",
        timestamp: Date.now(),
      };

      useCopilotStore.setState((state) => ({
        messages: [...state.messages, errorMessage],
        isProcessing: false,
        statusText: "",
        currentPreview: null,
      }));
    }
  }, [signAndExecuteTransaction]);

  return { executeTransaction };
}

/**
 * Builds the memory content payload for a successful transaction.
 */
function buildMemoryContent(
  metadata: TransactionMetadata,
  digest: string
): { type: "transaction"; content: string; metadata?: Record<string, unknown> } {
  if (metadata.type === "swap") {
    const route = metadata.route ?? [];
    const fromToken = route[0] ?? "unknown";
    const toToken = route[route.length - 1] ?? "unknown";
    const content = `Swapped ${fromToken} → ${toToken} via ${route.length > 2 ? "multi-hop" : "direct"} route`;
    return {
      type: "transaction",
      content,
      metadata: {
        action: "swap",
        tokens: route,
        estimatedOutput: metadata.estimatedOutput,
        minimumOutput: metadata.minimumOutput,
        exchangeRate: metadata.exchangeRate,
        priceImpact: metadata.priceImpact,
        outcome: "success",
        txDigest: digest,
      },
    };
  }

  // Stake
  const content = `Staked SUI with ${metadata.validatorName ?? "validator"} (est. APY ${metadata.estimatedApy ?? 0}%)`;
  return {
    type: "transaction",
    content,
    metadata: {
      action: "stake",
      tokens: ["SUI"],
      validatorName: metadata.validatorName,
      estimatedApy: metadata.estimatedApy,
      outcome: "success",
      txDigest: digest,
    },
  };
}

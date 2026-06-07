"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";

interface TransactionResultProps {
  message: ChatMessage;
}

/**
 * Renders a transaction result card — success or error.
 * Displays action summary, digest link, or error info depending on message type.
 */
export function TransactionResult({ message }: TransactionResultProps) {
  const isSuccess = message.type === "success";
  const explorerUrl = message.metadata?.explorerUrl;

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-4 py-3 text-sm",
          isSuccess ? "bg-green-500/10 text-foreground" : "bg-red-500/10 text-foreground"
        )}
        role={isSuccess ? "status" : "alert"}
        aria-live="polite"
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-blue-600 underline hover:text-blue-800"
            aria-label="View transaction on Sui Explorer"
          >
            View on Sui Explorer →
          </a>
        )}

        <time className="mt-1 block text-xs text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
    </div>
  );
}

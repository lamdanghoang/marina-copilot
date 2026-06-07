"use client";

import { cn } from "@/lib/utils";
import { TransactionResult } from "@/components/TransactionResult";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Render transaction results (success/error with metadata) using dedicated component
  if (
    (message.type === "success" || message.type === "error") &&
    message.role === "assistant" &&
    (message.metadata?.txDigest || message.metadata?.explorerUrl)
  ) {
    return <TransactionResult message={message} />;
  }

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : message.type === "error"
              ? "bg-red-500/10 text-foreground"
              : "bg-muted text-foreground"
        )}
      >
        {message.metadata?.memoryIndicator && !isUser && (
          <p className="mb-1 text-xs text-muted-foreground italic">
            💡 {message.metadata.memoryIndicator}
          </p>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
        <time className={cn(
          "mt-1 block text-xs",
          isUser ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
    </div>
  );
}

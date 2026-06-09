"use client";

import { cn } from "@/lib/utils";
import { TransactionResult } from "@/components/TransactionResult";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Transaction results use dedicated component
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
        "flex flex-col gap-1.5",
        isUser ? "items-end self-end max-w-[85%]" : "items-start max-w-[85%]"
      )}
    >
      {/* Label */}
      <span
        className={cn(
          "text-[10px] uppercase tracking-widest opacity-70",
          isUser ? "mr-1" : "ml-1 text-primary"
        )}
      >
        {isUser ? "You" : "Marina"}
      </span>

      {/* Bubble */}
      <div
        className={cn(
          "rounded-xl border p-4",
          isUser
            ? "rounded-tr-none border-primary/20 bg-primary/10 backdrop-blur-md shadow-[0_0_20px_rgba(0,238,252,0.05)]"
            : message.type === "error"
              ? "rounded-tl-none border-red-500/20 bg-red-500/5 glass-panel"
              : "rounded-tl-none border-border/10 glass-panel shadow-[0_40px_40px_-20px_rgba(143,245,255,0.05)]"
        )}
      >
        {message.metadata?.memoryIndicator && !isUser && (
          <p className="mb-2 text-[10px] uppercase tracking-widest text-primary/70">
            💡 {message.metadata.memoryIndicator}
          </p>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>

      {/* Timestamp */}
      <time className="text-[10px] text-muted-foreground/50 px-1">
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </time>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

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

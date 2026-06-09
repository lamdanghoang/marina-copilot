"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";

interface TransactionResultProps {
  message: ChatMessage;
}

export function TransactionResult({ message }: TransactionResultProps) {
  const isSuccess = message.type === "success";
  const explorerUrl = message.metadata?.explorerUrl;

  return (
    <div className="flex flex-col items-start gap-1.5 max-w-[85%]">
      <span className="ml-1 text-[10px] uppercase tracking-widest text-primary opacity-70">
        Marina
      </span>
      <div
        className={cn(
          "w-full rounded-xl rounded-tl-none border p-4",
          isSuccess
            ? "border-green-500/20 bg-green-500/5 glass-panel"
            : "border-red-500/20 bg-red-500/5 glass-panel"
        )}
        role={isSuccess ? "status" : "alert"}
        aria-live="polite"
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>

        {explorerUrl && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border/10 bg-muted/30 p-3">
            <span className="text-[10px] text-primary/60 font-mono">
              {message.metadata?.txDigest?.slice(0, 12)}...
            </span>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline"
              aria-label="View transaction on Sui Explorer"
            >
              View on Explorer
            </a>
          </div>
        )}
      </div>

      <time className="text-[10px] text-muted-foreground/50 px-1">
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </time>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  isDisabled: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, isDisabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;

    onSend(trimmed);
    setValue("");

    // Refocus input after send
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [value, isDisabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-border bg-background p-4">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        placeholder={placeholder ?? "Type your financial goal here..."}
        aria-label="Message input"
        rows={1}
        className={cn(
          "flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "min-h-[40px] max-h-[120px]"
        )}
      />
      <button
        onClick={handleSubmit}
        disabled={isDisabled || !value.trim()}
        aria-label="Send message"
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-md",
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90 transition-colors",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <SendIcon />
      </button>
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

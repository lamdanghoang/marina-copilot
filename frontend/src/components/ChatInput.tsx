"use client";

import { useState, useCallback, useRef } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isDisabled: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, isDisabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;
    onSend(trimmed);
    setValue("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [value, isDisabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-4 pb-4 pt-3">
      <div className="mx-auto max-w-3xl">
        <div className="glass-panel flex items-center gap-3 rounded-full border border-border/20 p-2 pl-6 shadow-[0_0_40px_rgba(0,0,0,0.3)]">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            placeholder={placeholder ?? "Message Marina Copilot..."}
            aria-label="Message input"
            className="flex-1 border-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={isDisabled || !value.trim()}
            aria-label="Send message"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#00eefc] text-primary-foreground shadow-[0_0_20px_rgba(0,238,252,0.4)] transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="m22 2-7 20-4-9-9-4 20-7Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  onFileAttach?: (file: File) => void;
  isDisabled: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onFileAttach, isDisabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFile = (file: File) => {
    if (onFileAttach) onFileAttach(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className="px-4 pb-4 pt-3"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="mx-auto max-w-3xl">
        {dragOver && (
          <div className="mb-2 rounded-xl border-2 border-dashed border-[#63f7ff] bg-[#63f7ff]/5 p-4 text-center text-sm text-[#63f7ff]">
            Drop file to upload to Walrus
          </div>
        )}
        <div className="glass-panel flex items-center gap-2 rounded-full border border-border/20 p-2 pl-4 shadow-[0_0_40px_rgba(0,0,0,0.3)]">
          {/* Attach button */}
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            aria-label="Attach file"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-[#63f7ff] hover:bg-[#63f7ff]/10 transition-colors disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="m22 2-7 20-4-9-9-4 20-7Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

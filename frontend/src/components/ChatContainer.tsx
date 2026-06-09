"use client";

import { useEffect, useRef } from "react";
import { useCopilotStore } from "@/store/copilot-store";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { PTBPreview } from "@/components/PTBPreview";
import { TypingIndicator } from "@/components/TypingIndicator";

export function ChatContainer() {
  const messages = useCopilotStore((s) => s.messages);
  const isProcessing = useCopilotStore((s) => s.isProcessing);
  const statusText = useCopilotStore((s) => s.statusText);
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const sendMessage = useCopilotStore((s) => s.sendMessage);
  const currentPreview = useCopilotStore((s) => s.currentPreview);
  const confirmTransaction = useCopilotStore((s) => s.confirmTransaction);
  const cancelPreview = useCopilotStore((s) => s.cancelPreview);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing, currentPreview]);

  const isWalletConnected = !!walletAddress;

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          {/* Date separator */}
          {isWalletConnected && (
            <div className="flex justify-center">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
                Today
              </span>
            </div>
          )}

          {messages.length === 0 && isWalletConnected && <WelcomeMessage />}
          {!isWalletConnected && <ConnectPrompt />}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isProcessing && <TypingIndicator statusText={statusText} />}

          {currentPreview && !isProcessing && (
            <div className="max-w-[90%]">
              <PTBPreview
                preview={currentPreview}
                onConfirm={confirmTransaction}
                onCancel={cancelPreview}
                isExecuting={isProcessing}
              />
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        isDisabled={isProcessing || !isWalletConnected}
        placeholder={
          !isWalletConnected ? "Connect wallet to start" : undefined
        }
      />
    </div>
  );
}

function WelcomeMessage() {
  return (
    <div className="flex flex-col items-start gap-1.5 max-w-[85%]">
      <span className="ml-1 text-[10px] uppercase tracking-widest text-primary opacity-70">
        Marina
      </span>
      <div className="glass-panel rounded-xl rounded-tl-none border border-border/10 p-4 shadow-[0_40px_40px_-20px_rgba(143,245,255,0.05)]">
        <p className="text-sm leading-relaxed">
          👋 Hello! I&apos;m your Marina Copilot on Sui. I can help you swap tokens, stake SUI, and check your portfolio. Just tell me what you&apos;d like to do.
        </p>
      </div>
    </div>
  );
}

function ConnectPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center mb-4">
        <span className="text-2xl">🔒</span>
      </div>
      <p className="font-headline text-lg font-bold text-foreground">
        Connect your wallet
      </p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        to start your DeFi journey
      </p>
    </div>
  );
}

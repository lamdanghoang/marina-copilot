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

  // Auto-scroll when new messages arrive or processing state changes
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing, currentPreview]);

  const isWalletConnected = !!walletAddress;

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && isWalletConnected && (
            <WelcomeMessage />
          )}

          {!isWalletConnected && (
            <ConnectPrompt />
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isProcessing && (
            <TypingIndicator statusText={statusText} />
          )}

          {currentPreview && !isProcessing && (
            <div className="flex justify-start">
              <div className="max-w-[90%]">
                <PTBPreview
                  preview={currentPreview}
                  onConfirm={confirmTransaction}
                  onCancel={cancelPreview}
                  isExecuting={isProcessing}
                />
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input area */}
      <ChatInput
        onSend={sendMessage}
        isDisabled={isProcessing || !isWalletConnected}
        placeholder={
          !isWalletConnected
            ? "Connect your wallet to start chatting"
            : undefined
        }
      />
    </div>
  );
}

function WelcomeMessage() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] rounded-lg bg-muted px-4 py-3 text-sm">
        <p className="font-medium">👋 Welcome! I&apos;m your DeFi Copilot.</p>
        <p className="mt-2 text-muted-foreground">I can help you:</p>
        <ul className="mt-1 list-inside list-disc text-muted-foreground">
          <li>Swap tokens</li>
          <li>Stake SUI</li>
        </ul>
        <p className="mt-2 text-muted-foreground">
          Just tell me what you&apos;d like to do.
        </p>
      </div>
    </div>
  );
}

function ConnectPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-lg font-medium text-foreground">
        🔒 Connect your wallet to start chatting
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Your AI-powered DeFi assistant on Sui
      </p>
    </div>
  );
}

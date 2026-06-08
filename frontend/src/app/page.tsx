"use client";

import { WalletButton } from "@/components/WalletButton";
import { ChatContainer } from "@/components/ChatContainer";
import { MemorySetup } from "@/components/MemorySetup";
import { SpriteCharacter } from "@/components/SpriteCharacter";
import { useCopilotStore } from "@/store/copilot-store";

function useCharacterAnimation(): string {
  const isProcessing = useCopilotStore((s) => s.isProcessing);
  const messages = useCopilotStore((s) => s.messages);
  const lastMsg = messages[messages.length - 1];

  if (isProcessing) return "thinking";
  if (lastMsg?.type === "success") return "happy";
  if (lastMsg?.type === "error") return "sad";
  if (lastMsg?.type === "preview") return "talking";
  if (lastMsg?.role === "assistant") return "talking";
  return "idle";
}

export default function Home() {
  const animation = useCharacterAnimation();
  const walletAddress = useCopilotStore((s) => s.walletAddress);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/50 px-6 py-3">
        <h1 className="font-headline text-lg font-bold text-primary glow-primary">
          DeFi Copilot
        </h1>
        <WalletButton />
      </header>

      {/* Memory setup prompt */}
      <MemorySetup />

      {/* Main area — character left + chat right */}
      <main className="flex flex-1 overflow-hidden">
        {/* Character panel — only show when connected */}
        {walletAddress && (
          <div className="hidden w-[320px] flex-col items-center justify-center border-r border-border/30 lg:flex">
            {/* Glow effect */}
            <div className="absolute h-[300px] w-[300px] rounded-full bg-primary/5 blur-3xl" />
            <SpriteCharacter animation={animation} size={260} fps={6} />
            <p className="mt-4 text-xs uppercase tracking-[3px] text-muted-foreground">
              {animation === "thinking"
                ? "Processing"
                : animation === "happy"
                  ? "Success"
                  : animation === "sad"
                    ? "Error"
                    : "Awaiting Input"}
            </p>
          </div>
        )}

        {/* Chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatContainer />
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center border-t border-border/30 px-6 py-2">
        <span className="text-xs text-muted-foreground">
          🐘 Powered by Walrus Memory
        </span>
      </footer>
    </div>
  );
}

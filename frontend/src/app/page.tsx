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
      {/* Header — Marina TopBar style */}
      <header className="fixed top-0 z-50 flex w-full items-center justify-between bg-transparent px-6 py-4 backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(143,245,255,0.08)]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <span className="text-lg">🤖</span>
          </div>
          <span className="font-headline text-lg font-bold tracking-tight text-primary">
            DeFi Copilot
          </span>
        </div>
        <WalletButton />
      </header>

      {/* Main area */}
      <main className="flex flex-1 overflow-hidden pt-20">
        {/* Character panel */}
        {walletAddress && (
          <div className="relative hidden w-[300px] flex-col items-center justify-center lg:flex">
            {/* Glow */}
            <div className="absolute h-[400px] w-[400px] rounded-full bg-primary/5 blur-[120px]" />
            <div className="relative z-10">
              <SpriteCharacter animation={animation} size={240} fps={6} />
            </div>
            {/* Status */}
            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {animation === "thinking"
                  ? "Processing"
                  : animation === "happy"
                    ? "Complete"
                    : animation === "sad"
                      ? "Error"
                      : "Awaiting Input"}
              </span>
              <div className="h-0.5 w-12 rounded-full bg-primary shadow-[0_0_10px_#8ff5ff]" />
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <MemorySetup />
          <ChatContainer />
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center py-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
          🐘 Powered by Walrus Memory
        </span>
      </footer>
    </div>
  );
}

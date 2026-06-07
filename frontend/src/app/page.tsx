"use client";

import { WalletButton } from "@/components/WalletButton";
import { ChatContainer } from "@/components/ChatContainer";

export default function Home() {
  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-3">
        <h1 className="text-lg font-bold text-foreground">DeFi Copilot</h1>
        <WalletButton />
      </header>

      {/* Main chat area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <ChatContainer />
      </main>

      {/* Footer with Walrus Memory indicator */}
      <footer className="flex items-center justify-center border-t px-6 py-2">
        <span className="text-xs text-muted-foreground">
          🐘 Powered by Walrus Memory
        </span>
      </footer>
    </div>
  );
}

"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import { WalletButton } from "@/components/WalletButton";

export default function Home() {
  const account = useCurrentAccount();
  const isConnected = !!account?.address;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-3">
        <h1 className="text-lg font-bold text-foreground">DeFi Copilot</h1>
        <WalletButton />
      </header>

      {/* Main chat area */}
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        {!isConnected ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-muted-foreground">
              Connect your wallet to start using DeFi Copilot
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Start by typing your financial goal below
          </p>
        )}
      </main>

      {/* Chat input area */}
      <footer className="border-t px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <input
            type="text"
            placeholder={
              isConnected
                ? "Type your message..."
                : "Connect your wallet to chat"
            }
            disabled={!isConnected}
            className="flex-1 rounded-lg border bg-background px-4 py-2 text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Chat message input"
          />
          <button
            disabled={!isConnected}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}

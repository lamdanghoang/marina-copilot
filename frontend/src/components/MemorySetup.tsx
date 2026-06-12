"use client";

import { useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useMemwalSetup, loadCredentials } from "@/hooks/useMemwalSetup";
import { useCopilotStore } from "@/store/copilot-store";

/**
 * Handles MemWal account setup and syncs credentials to store.
 * Renders setup prompt if user hasn't set up memory yet.
 */
export function MemorySetup() {
  const storeWalletAddress = useCopilotStore((s) => s.walletAddress);
  const account = useCurrentAccount();
  const walletAddress = storeWalletAddress || account?.address || null;
  const setMemwalCredentials = useCopilotStore((s) => s.setMemwalCredentials);

  const { credentials, hasAccount, isSettingUp, checkAccount, setup } =
    useMemwalSetup(walletAddress);

  // Check account status on wallet connect
  useEffect(() => {
    if (walletAddress) {
      // Try loading from localStorage first
      const saved = loadCredentials(walletAddress);
      if (saved) {
        setMemwalCredentials(saved);
      } else {
        checkAccount();
      }
    }
  }, [walletAddress, checkAccount, setMemwalCredentials]);

  // Sync credentials to store when available
  useEffect(() => {
    if (credentials) {
      setMemwalCredentials(credentials);
    }
  }, [credentials, setMemwalCredentials]);

  // Don't render anything if wallet not connected or already set up
  if (!walletAddress || credentials) return null;

  // Account exists on-chain but no local key → need re-authorization
  if (hasAccount === true && !credentials) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-2">
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
          <span className="text-lg">🔑</span>
          <div className="flex-1 text-sm">
            <p className="font-medium">Re-authorize Memory</p>
            <p className="text-muted-foreground">
              Your memory account exists but needs a new access key.
            </p>
          </div>
          <button
            onClick={setup}
            disabled={isSettingUp}
            className="rounded-md bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            {isSettingUp ? "Setting up..." : "Authorize"}
          </button>
        </div>
      </div>
    );
  }

  // No account → prompt setup
  if (hasAccount === false) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-2">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <span className="text-lg">🧠</span>
          <div className="flex-1 text-sm">
            <p className="font-medium">Enable Persistent Memory</p>
            <p className="text-muted-foreground">
              I&apos;ll remember your preferences across sessions. One-time setup (~0.02 SUI).
            </p>
          </div>
          <button
            onClick={setup}
            disabled={isSettingUp}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSettingUp ? "Setting up..." : "Set up"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

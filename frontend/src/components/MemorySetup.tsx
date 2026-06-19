"use client";

import { useCopilotStore } from "@/store/copilot-store";
import { useMemwalSetup } from "@/hooks/useMemwalSetup";
import { Brain } from "lucide-react";

/**
 * Shows memory setup prompt. Only renders if:
 * - Wallet connected
 * - No memwal credentials in store (not setup yet)
 */
export function MemorySetup() {
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const memwalCredentials = useCopilotStore((s) => s.memwalCredentials);

  const { isSettingUp, setup } = useMemwalSetup(walletAddress);

  // Already setup or no wallet → don't show
  if (!walletAddress || memwalCredentials) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-2">
      <div className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/50 px-4 py-3">
        <span className="text-lg"><Brain size={20} className="text-[#63f7ff]" /></span>
        <div className="flex-1 text-sm">
          <p className="font-medium">Enable Persistent Memory</p>
          <p className="text-muted-foreground text-xs">
            I&apos;ll remember your preferences across sessions. One-time setup (~0.02 SUI).
          </p>
        </div>
        <button
          onClick={setup}
          disabled={isSettingUp}
          className="rounded-md bg-[#63f7ff] px-3 py-1.5 text-xs font-bold text-[#002021] hover:bg-cyan-100 disabled:opacity-50"
        >
          {isSettingUp ? "Setting up..." : "Set up"}
        </button>
      </div>
    </div>
  );
}

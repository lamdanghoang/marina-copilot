"use client";

import { useState } from "react";
import { useCopilotStore } from "@/store/copilot-store";
import { loadCredentials } from "@/hooks/useMemwalSetup";
import { networkConfig } from "@/lib/config";

export default function SettingsPage() {
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const memwalCredentials = useCopilotStore((s) => s.memwalCredentials);
  const [revoking, setRevoking] = useState(false);

  const creds = walletAddress ? loadCredentials(walletAddress) : null;
  const hasMemwal = !!(memwalCredentials || creds);

  const handleRevokeDelegateKey = async () => {
    if (!walletAddress || !memwalCredentials) return;
    if (!confirm("Revoke delegate key? Marina will no longer remember your preferences.")) return;
    setRevoking(true);
    try {
      // Clear local credentials
      localStorage.removeItem(`marina-copilot-memwal-${walletAddress}`);
      useCopilotStore.getState().setMemwalCredentials(null);
      alert("Delegate key removed locally. To fully revoke on-chain, call remove_delegate_key from your wallet.");
    } finally {
      setRevoking(false);
    }
  };

  const handleClearMemories = () => {
    if (!walletAddress) return;
    if (!confirm("Clear all local memories? AI will forget your history.")) return;
    localStorage.removeItem(`marina-copilot-memories-${walletAddress}`);
    alert("Local memories cleared.");
  };

  const handleClearChat = () => {
    if (!walletAddress) return;
    if (!confirm("Clear all chat history?")) return;
    localStorage.removeItem(`marina-copilot-messages-${walletAddress}`);
    useCopilotStore.getState().clearHistory();
    alert("Chat history cleared.");
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-6">Settings</h1>

      {/* Network */}
      <Section title="Network">
        <Item label="Current Network" value={networkConfig.network.toUpperCase()} />
        <Item label="RPC" value={networkConfig.rpcUrl} />
      </Section>

      {/* Memory (Walrus) */}
      <Section title="Memory (Walrus/MemWal)">
        <Item label="Status" value={hasMemwal ? "✅ Active" : "❌ Not configured"} />
        {hasMemwal && (
          <>
            <Item label="Account ID" value={memwalCredentials?.accountId?.slice(0, 16) + "..." || "—"} />
            <Item label="Delegate Key" value="••••••••" />
            <button
              onClick={handleRevokeDelegateKey}
              disabled={revoking}
              className="mt-2 w-full rounded-md border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 disabled:opacity-50"
            >
              {revoking ? "Revoking..." : "Revoke Delegate Key"}
            </button>
          </>
        )}
      </Section>

      {/* Data */}
      <Section title="Data & Privacy">
        <button
          onClick={handleClearMemories}
          className="w-full rounded-md border border-border/30 bg-muted/30 px-4 py-2 text-sm text-white hover:bg-muted/50 text-left"
        >
          Clear AI Memories
          <span className="block text-xs text-gray-400">Remove local action history (swap, transfer, capsule records)</span>
        </button>
        <button
          onClick={handleClearChat}
          className="mt-2 w-full rounded-md border border-border/30 bg-muted/30 px-4 py-2 text-sm text-white hover:bg-muted/50 text-left"
        >
          Clear Chat History
          <span className="block text-xs text-gray-400">Delete all messages from this browser</span>
        </button>
      </Section>

      {/* About */}
      <Section title="About">
        <Item label="App" value="Marina Copilot" />
        <Item label="Track" value="Walrus — Sui Overflow 2026" />
        <Item label="Wallet" value={walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-4)}` : "Not connected"} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</h2>
      <div className="rounded-lg border border-border/20 bg-[#0a1a1a] p-4 space-y-2">
        {children}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-gray-300">{label}</span>
      <span className="text-sm text-gray-400 font-mono">{value}</span>
    </div>
  );
}

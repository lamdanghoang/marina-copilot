"use client";

import { useState, useEffect } from "react";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { useCopilotStore } from "@/store/copilot-store";
import { loadCredentials } from "@/hooks/useMemwalSetup";
import { networkConfig } from "@/lib/config";
import { findMemwalAccount } from "@/lib/sui-graphql";
import { useToast } from "@/components/Toast";
import { Transaction } from "@mysten/sui/transactions";

const MEMWAL_PACKAGE_ID = "0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6";

export default function SettingsPage() {
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const memwalCredentials = useCopilotStore((s) => s.memwalCredentials);
  const dAppKit = useDAppKit();
  const toast = useToast();
  const [loading, setLoading] = useState("");
  const [accountActive, setAccountActive] = useState<boolean | null>(null);

  const creds = walletAddress ? loadCredentials(walletAddress) : null;
  const hasMemwal = !!(memwalCredentials || creds);
  const accountId = memwalCredentials?.accountId || creds?.accountId;

  // Query on-chain active status
  useEffect(() => {
    if (!walletAddress) return;
    findMemwalAccount(MEMWAL_PACKAGE_ID, walletAddress)
      .then((res) => setAccountActive(res?.active ?? null))
      .catch(() => setAccountActive(null));
  }, [walletAddress]);

  const signAndExecute = async (tx: Transaction) => {
    const res = await (dAppKit as any).signAndExecuteTransaction({ transaction: tx });
    return (res as any)?.Transaction?.digest ?? (res as any)?.digest ?? "";
  };

  const handleRevoke = async () => {
    if (!walletAddress || !accountId || !memwalCredentials) return;
    if (!confirm("Revoke delegate key on-chain? Marina will lose memory access until you set up again.")) return;
    setLoading("revoke");
    try {
      const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
      const keypair = Ed25519Keypair.fromSecretKey(memwalCredentials.delegateKey);
      const pubkey = keypair.getPublicKey().toRawBytes();

      const tx = new Transaction();
      tx.moveCall({
        target: `${MEMWAL_PACKAGE_ID}::account::remove_delegate_key`,
        arguments: [tx.object(accountId), tx.pure.vector("u8", Array.from(pubkey))],
      });
      await signAndExecute(tx);
      localStorage.removeItem(`marina-copilot-memwal-${walletAddress}`);
      useCopilotStore.getState().setMemwalCredentials(null);
      toast("Delegate key revoked on-chain.", "success");
    } catch (e: any) {
      toast("Failed: " + (e.message || e), "error");
    } finally {
      setLoading("");
    }
  };

  const handleDeactivate = async () => {
    if (!accountId) return;
    if (!confirm("Deactivate account? All delegate keys stop working until reactivated.")) return;
    setLoading("deactivate");
    try {
      const tx = new Transaction();
      tx.moveCall({ target: `${MEMWAL_PACKAGE_ID}::account::deactivate_account`, arguments: [tx.object(accountId)] });
      await signAndExecute(tx);
      setAccountActive(false);
      toast("Account deactivated.", "success");
    } catch (e: any) {
      toast("Failed: " + (e.message || e), "error");
    } finally {
      setLoading("");
    }
  };

  const handleReactivate = async () => {
    if (!accountId) return;
    setLoading("reactivate");
    try {
      const tx = new Transaction();
      tx.moveCall({ target: `${MEMWAL_PACKAGE_ID}::account::reactivate_account`, arguments: [tx.object(accountId)] });
      await signAndExecute(tx);
      setAccountActive(true);
      toast("Account reactivated.", "success");
    } catch (e: any) {
      toast("Failed: " + (e.message || e), "error");
    } finally {
      setLoading("");
    }
  };

  const handleClearMemories = () => {
    if (!walletAddress || !confirm("Clear local memories?")) return;
    localStorage.removeItem(`marina-copilot-memories-${walletAddress}`);
    toast("Local memories cleared.", "success");
  };

  const handleClearChat = () => {
    if (!walletAddress || !confirm("Clear chat history?")) return;
    localStorage.removeItem(`marina-copilot-messages-${walletAddress}`);
    useCopilotStore.getState().clearHistory();
    toast("Chat history cleared.", "success");
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-6">Settings</h1>

      {/* Account */}
      <Section title="Account">
        <Item label="Wallet" value={walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-4)}` : "Not connected"} />
        <Item label="MemWal" value={hasMemwal ? "✅ Active" : "❌ Not configured"} />
        {accountId && <Item label="Account ID" value={accountId.slice(0, 16) + "..."} />}
        {accountActive !== null && <Item label="On-Chain Status" value={accountActive ? "🟢 Active" : "🔴 Deactivated"} />}
        {hasMemwal && (
          <>
            {accountActive === true && (
              <Btn onClick={handleDeactivate} loading={loading === "deactivate"} variant="warning" label="Deactivate Account" desc="Pause all delegate keys (reversible)" />
            )}
            {accountActive === false && (
              <Btn onClick={handleReactivate} loading={loading === "reactivate"} variant="default" label="Reactivate Account" desc="Resume delegate key access" />
            )}
            <Btn onClick={handleRevoke} loading={loading === "revoke"} variant="danger" label="Revoke Delegate Key" desc="Remove AI memory access (irreversible until re-setup)" />
          </>
        )}
      </Section>

      {/* Network */}
      <Section title="Network">
        <Item label="Network" value={networkConfig.network.toUpperCase()} />
        <Item label="RPC" value={networkConfig.rpcUrl} />
      </Section>

      {/* Data & Privacy */}
      <Section title="Data & Privacy">
        <Btn onClick={handleClearMemories} label="Clear Local Memories" desc="Remove cached action history from this browser" variant="default" />
        <Btn onClick={handleClearChat} label="Clear Chat History" desc="Delete all messages from this browser" variant="default" />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</h2>
      <div className="rounded-lg border border-border/20 bg-[#0a1a1a] p-4 space-y-3">{children}</div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-gray-300">{label}</span>
      <span className="text-sm text-gray-400 font-mono truncate ml-4 max-w-[200px]">{value}</span>
    </div>
  );
}

function Btn({ onClick, loading, label, desc, variant = "default" }: {
  onClick: () => void; loading?: boolean; label: string; desc: string; variant?: "default" | "danger" | "warning";
}) {
  const c = { default: "border-border/30 bg-muted/30 text-white hover:bg-muted/50", danger: "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20", warning: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20" };
  return (
    <button onClick={onClick} disabled={!!loading} className={`w-full rounded-md border px-4 py-2 text-sm text-left disabled:opacity-50 ${c[variant]}`}>
      {loading ? "Processing..." : label}
      <span className="block text-xs text-gray-500">{desc}</span>
    </button>
  );
}

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
    const account = (dAppKit as any).currentAccount;
    if (account) {
      const res = await (dAppKit as any).signAndExecuteTransaction({ transaction: tx });
      return (res as any)?.Transaction?.digest ?? (res as any)?.digest ?? "";
    }
    const { signAndExecuteZkLogin } = await import("@/lib/zklogin-signer");
    const res = await signAndExecuteZkLogin({ transaction: tx });
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
        {walletAddress ? <CopyItem label="Wallet" value={walletAddress} /> : <Item label="Wallet" value="Not connected" />}
        <Item label="MemWal" value={hasMemwal ? "✅ Active" : "❌ Not configured"} />
        {accountId && (
          <div className="flex justify-between items-center py-1">
            <span className="text-sm text-gray-300">Account ID</span>
            <a href={`${networkConfig.explorerBase.replace("/tx/", "/object/")}${accountId}`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 font-mono hover:text-[#63f7ff] transition-colors underline decoration-dotted">
              {accountId.slice(0, 10)}...{accountId.slice(-4)} ↗
            </a>
          </div>
        )}
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

      {/* Contacts */}
      <Section title="Contacts">
        <ContactsManager />
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


function CopyItem({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-gray-300">{label}</span>
      <button onClick={handleCopy} className="flex items-center gap-1.5 text-sm text-gray-400 font-mono hover:text-[#63f7ff] transition-colors">
        <span>{value.slice(0, 8)}...{value.slice(-4)}</span>
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        )}
      </button>
    </div>
  );
}


function ContactsManager() {
  const [contacts, setContacts] = useState<Array<{ name: string; address: string }>>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    try { setContacts(JSON.parse(localStorage.getItem("marina-copilot-contacts") || "[]")); } catch {}
  }, []);

  const handleAdd = () => {
    if (!name.trim() || !address.trim()) return;
    const updated = [...contacts, { name: name.trim(), address: address.trim() }];
    setContacts(updated);
    localStorage.setItem("marina-copilot-contacts", JSON.stringify(updated));
    setName(""); setAddress("");
  };

  const handleRemove = (addr: string) => {
    const updated = contacts.filter((c) => c.address !== addr);
    setContacts(updated);
    localStorage.setItem("marina-copilot-contacts", JSON.stringify(updated));
  };

  return (
    <div className="space-y-3">
      {contacts.map((c) => (
        <div key={c.address} className="flex items-center justify-between py-1">
          <div>
            <span className="text-sm text-gray-300">{c.name}</span>
            <span className="text-xs text-gray-500 font-mono ml-2">{c.address.slice(0, 8)}...{c.address.slice(-4)}</span>
          </div>
          <button onClick={() => handleRemove(c.address)} className="text-xs text-red-400 hover:text-red-300">✕</button>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="flex-1 rounded-md border border-border/30 bg-transparent px-3 py-1.5 text-xs focus:outline-none focus:border-[#63f7ff]/50" />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x..." className="flex-[2] rounded-md border border-border/30 bg-transparent px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#63f7ff]/50" />
        <button onClick={handleAdd} disabled={!name || !address} className="rounded-md bg-[#63f7ff] px-3 py-1.5 text-xs font-bold text-[#002021] disabled:opacity-50">Add</button>
      </div>
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

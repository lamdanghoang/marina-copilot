"use client";

import { useState, useEffect } from "react";
import { useDAppKit, useCurrentAccount } from "@mysten/dapp-kit-react";
import { useCopilotStore } from "@/store/copilot-store";
import { useToast } from "@/components/Toast";
import { gqlClient } from "@/lib/sui-graphql";
import { Lock, Unlock, Clock, ShieldCheck } from "lucide-react";

const CAPSULE_PACKAGE = "0x6f0a3c7df312c0d07d1dafbc38e4acbbfedaa6f651aab4efa764a91221b1cb53";

export default function CapsulesPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [loading, setLoading] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [now, setNow] = useState(Date.now());
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const capsules = useCopilotStore((s) => s.capsules);
  const toast = useToast();
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch capsules from on-chain (only if store empty)
  useEffect(() => {
    if (!walletAddress || capsules.length > 0) return;
    setLoading(true);
    gqlClient.query({
      query: `{
        objects(filter: { type: "${CAPSULE_PACKAGE}::capsule::Capsule", owner: "${walletAddress}" }, first: 50) {
          nodes { address asMoveObject { contents { json } } }
        }
      }` as any,
    } as any).then((res: any) => {
      const nodes = (res.data as any)?.objects?.nodes || [];
      useCopilotStore.setState({ capsules: nodes.map((n: any) => ({ id: n.address, ...n.asMoveObject?.contents?.json })) });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [walletAddress, capsules.length]);

  const handleUnlock = async (capsule: any) => {
    if (!walletAddress) return;
    setUnlocking(true);
    try {
      const { unlockCapsule } = await import("@/lib/walrus-seal");

      const content = await unlockCapsule({
        blobId: capsule.blob_id,
        unlockTimeMs: Number(capsule.unlock_date),
        recipient: capsule.recipient,
        userAddress: walletAddress,
        signPersonalMessage: ({ message }) => dAppKit.signPersonalMessage({ message }),
      });
      setDecryptedContent(content);
      toast("Capsule decrypted!", "success");
    } catch (e: any) {
      toast(e.message || "Failed to unlock", "error");
    } finally {
      setUnlocking(false);
    }
  };

  if (view === "create") return <CreateCapsule onBack={() => { useCopilotStore.setState({ capsules: [] }); setView("list"); }} />;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="font-headline text-3xl font-bold text-foreground">Time Capsules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Secure messages encrypted with Seal, stored on Walrus. Unlock when the time is right.
          </p>
        </div>

        <button
          onClick={() => setView("create")}
          className="w-full glass-panel rounded-xl py-3 px-4 border-dashed border-[rgba(0,245,255,0.3)] hover:border-[#63f7ff] transition-colors flex items-center justify-center gap-2 text-sm text-[#63f7ff] font-bold"
        >
          + Create New Capsule
        </button>

        {loading ? (
          <p className="text-center text-muted-foreground text-sm py-8">Loading capsules...</p>
        ) : capsules.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No capsules yet. Create your first one!</p>
        ) : (
          <>
            {(() => {
              const sorted = [...capsules].sort((a, b) => Number(b.created_at) - Number(a.created_at));
              const locked = sorted.filter((c) => now < Number(c.unlock_date));
              const unlockable = sorted.filter((c) => now >= Number(c.unlock_date));
              return (
                <>
                  {unlockable.length > 0 && (
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-widest text-green-400 mb-3"><Unlock size={12} className="inline" /> Ready to Open ({unlockable.length})</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {unlockable.map((c) => <CapsuleCard key={c.id} capsule={c} now={now} onUnlock={handleUnlock} />)}
                      </div>
                    </div>
                  )}
                  {locked.length > 0 && (
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-widest text-[#63f7ff]/60 mb-3"><Lock size={12} className="inline" /> Locked ({locked.length})</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {locked.map((c) => <CapsuleCard key={c.id} capsule={c} now={now} onUnlock={handleUnlock} />)}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* Decrypted content modal */}
        {decryptedContent && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDecryptedContent(null)}>
            <div className="glass-panel rounded-2xl p-6 max-w-md w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-headline text-lg font-bold text-[#63f7ff]"><Unlock size={16} className="inline" /> Capsule Unlocked</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 p-4 rounded-lg">{decryptedContent}</p>
              <button onClick={() => setDecryptedContent(null)} className="w-full rounded-xl bg-[#63f7ff] py-2.5 font-bold text-sm text-[#002021]">Close</button>
            </div>
          </div>
        )}

        {unlocking && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
            <div className="animate-pulse text-[#63f7ff] text-lg">Decrypting...</div>
          </div>
        )}
      </div>
    </div>
  );
}


function CapsuleCard({ capsule: c, now, onUnlock }: { capsule: any; now: number; onUnlock: (c: any) => void }) {
  const unlockMs = Number(c.unlock_date);
  const locked = now < unlockMs;
  const remaining = locked ? formatRemaining(unlockMs - now) : "Ready to open";
  return (
    <div className={`glass-panel rounded-xl p-6 transition-transform ${!locked ? "cursor-pointer hover:scale-[1.02]" : ""}`} onClick={() => !locked && onUnlock(c)}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className={`text-[10px] uppercase tracking-widest flex items-center gap-1 ${locked ? "text-[#63f7ff]/60" : "text-green-400"}`}>
            {locked ? <><Clock size={10} /> Waiting</> : <><Unlock size={10} /> Click to unlock</>}
          </span>
          <h3 className="font-headline text-sm font-bold mt-1 font-mono">From: {c.owner?.slice(0, 8)}...{c.owner?.slice(-4)}</h3>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted text-[#63f7ff]">
          <ShieldCheck size={20} />
        </div>
      </div>
      <div className="text-center py-3">
        <span className={`font-headline text-2xl font-light tracking-wider ${locked ? "text-[#63f7ff]" : "text-green-400"}`}>{remaining}</span>
      </div>
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-[rgba(0,245,255,0.1)]">
        <a href={`https://walruscan.com/testnet/blob/${c.blob_id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-muted-foreground hover:text-[#63f7ff] transition-colors">Blob: {c.blob_id?.slice(0, 12)}... ↗</a>
        <span className="text-[10px] text-muted-foreground">{new Date(Number(c.created_at)).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
function formatRemaining(ms: number): string {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function CreateCapsule({ onBack }: { onBack: () => void }) {
  const [content, setContent] = useState("");
  const [recipient, setRecipient] = useState("");
  const [unlockTime, setUnlockTime] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState("");
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const toast = useToast();

  const handleCreate = async () => {
    const sender = account?.address || useCopilotStore.getState().walletAddress;
    if (!sender) { toast("Connect wallet first", "error"); return; }
    if (!content || !unlockTime) return;

    setIsCreating(true);
    try {
      const { createCapsule } = await import("@/lib/walrus-seal");
      const { isZkLoginSession, signAndExecuteZkLogin } = await import("@/lib/zklogin-signer");
      const unlockDate = new Date(unlockTime);
      const unlockAfterMinutes = Math.max(1, Math.round((unlockDate.getTime() - Date.now()) / 60000));

      const signAndExecute = account
        ? async (args: { transaction: any }) => (dAppKit as any).signAndExecuteTransaction({ transaction: args.transaction })
        : signAndExecuteZkLogin;

      const capsule = await createCapsule({
        content,
        unlockAfterMinutes,
        recipient: recipient || sender,
        sender,
        signAndExecute,
        onProgress: (step) => setStatus(step),
      });

      toast(`Capsule created! Unlocks ${unlockDate.toLocaleString()}`, "success");
      onBack();
    } catch (e: any) {
      toast(e.message || "Failed to create capsule", "error");
    } finally {
      setIsCreating(false);
      setStatus("");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-full bg-muted/30 hover:bg-muted/50 flex items-center justify-center text-[#63f7ff]">
            ←
          </button>
          <h2 className="font-headline text-xl font-bold">Create Capsule</h2>
        </div>

        <div className="glass-panel rounded-2xl p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Recipient / Label</label>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. Future Self, Project Notes"
              className="w-full rounded-xl border border-[rgba(0,245,255,0.15)] bg-[#0d1515] px-4 py-3.5 text-sm focus:outline-none focus:border-[#63f7ff]/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Unlock Date & Time</label>
            <input
              type="datetime-local"
              value={unlockTime}
              onChange={(e) => setUnlockTime(e.target.value)}
              className="w-full rounded-xl border border-[rgba(0,245,255,0.15)] bg-[#0d1515] px-4 py-3.5 text-sm focus:outline-none focus:border-[#63f7ff]/50 [color-scheme:dark]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Secret Message</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="The message to encrypt until unlock time..."
              rows={5}
              className="w-full rounded-xl border border-[rgba(0,245,255,0.15)] bg-[#0d1515] px-4 py-3.5 text-sm resize-none focus:outline-none focus:border-[#63f7ff]/50"
            />
          </div>

          {/* Info */}
          <div className="flex gap-3 p-4 rounded-xl bg-muted/20 border border-[rgba(0,245,255,0.1)]">
            <Lock size={16} className="text-[#63f7ff]" />
            <div>
              <p className="text-xs font-bold">Time-Lock Encryption</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Encrypted with Seal threshold encryption, stored on Walrus. Decryptable only after the unlock time is reached on-chain.
              </p>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!content || !unlockTime || isCreating}
            className="w-full rounded-xl bg-[#63f7ff] py-3.5 font-headline font-bold text-sm text-[#002021] hover:bg-cyan-100 transition-all shadow-[0_0_15px_rgba(99,247,255,0.2)] disabled:opacity-50"
          >
            {isCreating ? status || "Creating..." : "Encrypt & Store on Walrus"}
          </button>

          <p className="text-[10px] text-center text-muted-foreground">~0.05 SUI for gas + Walrus storage</p>
        </div>
      </div>
    </div>
  );
}

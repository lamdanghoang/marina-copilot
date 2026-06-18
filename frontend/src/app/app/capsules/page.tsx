"use client";

import { useState, useEffect } from "react";
import { useDAppKit, useCurrentAccount } from "@mysten/dapp-kit-react";
import { useCopilotStore } from "@/store/copilot-store";
import { useToast } from "@/components/Toast";
import { gqlClient } from "@/lib/sui-graphql";

const CAPSULE_PACKAGE = "0x6f0a3c7df312c0d07d1dafbc38e4acbbfedaa6f651aab4efa764a91221b1cb53";

export default function CapsulesPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [capsules, setCapsules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const walletAddress = useCopilotStore((s) => s.walletAddress);

  // Fetch capsules from on-chain
  useEffect(() => {
    if (!walletAddress) { setLoading(false); return; }
    gqlClient.query({
      query: `{
        objects(filter: { type: "${CAPSULE_PACKAGE}::capsule::Capsule", owner: "${walletAddress}" }, first: 50) {
          nodes { address asMoveObject { contents { json } } }
        }
      }` as any,
    } as any).then((res: any) => {
      const nodes = (res.data as any)?.objects?.nodes || [];
      setCapsules(nodes.map((n: any) => ({ id: n.address, ...n.asMoveObject?.contents?.json })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [walletAddress]);

  if (view === "create") return <CreateCapsule onBack={() => setView("list")} />;

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
          className="w-full glass-panel rounded-xl p-4 border-dashed border-[rgba(0,245,255,0.3)] hover:border-[#63f7ff] transition-colors flex items-center justify-center gap-2 text-sm text-[#63f7ff] font-bold"
        >
          + Create New Capsule
        </button>

        {loading ? (
          <p className="text-center text-muted-foreground text-sm py-8">Loading capsules...</p>
        ) : capsules.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No capsules yet. Create your first one!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {capsules.map((c) => {
              const unlockMs = Number(c.unlock_date);
              const locked = Date.now() < unlockMs;
              const remaining = locked ? formatRemaining(unlockMs - Date.now()) : "Ready to open";
              return (
                <div key={c.id} className="glass-panel rounded-xl p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className={`text-[10px] uppercase tracking-widest ${locked ? "text-[#63f7ff]/60" : "text-green-400"}`}>
                        {locked ? "🔒 Locked" : "🔓 Unlockable"}
                      </span>
                      <h3 className="font-headline text-sm font-bold mt-1 font-mono">{c.recipient?.slice(0, 8)}...{c.recipient?.slice(-4)}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted text-[#63f7ff]">🛡️</div>
                  </div>
                  <div className="text-center py-3">
                    <span className="font-headline text-2xl font-light text-[#63f7ff] tracking-wider">{remaining}</span>
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-[rgba(0,245,255,0.1)]">
                    <span className="text-[10px] text-muted-foreground">Blob: {c.blob_id?.slice(0, 12)}...</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(Number(c.created_at)).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRemaining(ms: number): string {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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
            <span>🔒</span>
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

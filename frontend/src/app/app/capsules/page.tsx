"use client";

import { useState } from "react";

interface Capsule {
  id: string;
  recipient: string;
  status: "locked" | "unlocked";
  remainingTime?: string;
  unlockDate?: string;
  createdDate: string;
  preview?: string;
}

const DEMO_CAPSULES: Capsule[] = [
  { id: "1", recipient: "Future Self", status: "locked", remainingTime: "2d 14h", createdDate: "Jun 15, 2026" },
  { id: "2", recipient: "Project Notes", status: "unlocked", createdDate: "Jun 10, 2026", preview: "The DeFi integration strategy is working well. Next step: integrate Walrus Memory..." },
];

export default function CapsulesPage() {
  const [view, setView] = useState<"list" | "create">("list");

  if (view === "create") return <CreateCapsule onBack={() => setView("list")} />;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-headline text-3xl font-bold text-foreground">Time Capsules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Secure messages encrypted with Seal, stored on Walrus. Unlock when the time is right.
          </p>
        </div>

        {/* Create button */}
        <button
          onClick={() => setView("create")}
          className="w-full glass-panel rounded-xl p-4 border-dashed border-[rgba(0,245,255,0.3)] hover:border-[#63f7ff] transition-colors flex items-center justify-center gap-2 text-sm text-[#63f7ff] font-bold"
        >
          + Create New Capsule
        </button>

        {/* Capsule list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DEMO_CAPSULES.map((capsule) => (
            <div
              key={capsule.id}
              className={`glass-panel rounded-xl p-6 cursor-pointer hover:scale-[1.02] transition-transform ${
                capsule.status === "unlocked" ? "border-[#63f7ff]/20" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className={`text-[10px] uppercase tracking-widest ${capsule.status === "unlocked" ? "text-green-400" : "text-[#63f7ff]/60"}`}>
                    {capsule.status === "locked" ? "🔒 Locked" : "🔓 Unlocked"}
                  </span>
                  <h3 className="font-headline text-lg font-bold mt-1">{capsule.recipient}</h3>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${capsule.status === "unlocked" ? "bg-[#63f7ff] text-[#002021]" : "bg-muted text-[#63f7ff]"}`}>
                  🛡️
                </div>
              </div>

              {capsule.status === "locked" ? (
                <div className="text-center py-3">
                  <span className="font-headline text-2xl font-light text-[#63f7ff] tracking-wider">
                    {capsule.remainingTime}
                  </span>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Until unlock</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic bg-muted/30 p-3 rounded-lg">
                  {capsule.preview}
                </p>
              )}

              <div className="flex justify-between items-center mt-4 pt-3 border-t border-[rgba(0,245,255,0.1)]">
                <span className="text-[10px] text-muted-foreground">Created {capsule.createdDate}</span>
                <span className="text-[10px] text-[#63f7ff]/60 font-mono">WALRUS-v2</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreateCapsule({ onBack }: { onBack: () => void }) {
  const [content, setContent] = useState("");
  const [recipient, setRecipient] = useState("");
  const [unlockTime, setUnlockTime] = useState("");

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
            disabled={!content || !unlockTime}
            className="w-full rounded-xl bg-[#63f7ff] py-3.5 font-headline font-bold text-sm text-[#002021] hover:bg-cyan-100 transition-all shadow-[0_0_15px_rgba(99,247,255,0.2)] disabled:opacity-50"
          >
            Encrypt & Store on Walrus
          </button>

          <p className="text-[10px] text-center text-muted-foreground">~0.05 SUI for gas + Walrus storage</p>
        </div>
      </div>
    </div>
  );
}

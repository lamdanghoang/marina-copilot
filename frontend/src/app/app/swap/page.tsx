"use client";

import { useState, useRef, useEffect } from "react";
import { useCopilotStore } from "@/store/copilot-store";
import { processIntent } from "@/lib/api-client";
import { useTransactionExecution } from "@/hooks/useTransactionExecution";

const TOKENS = ["SUI", "USDC", "USDT", "WETH", "CETUS"];

export default function SwapPage() {
  const [amount, setAmount] = useState("1");
  const [fromToken, setFromToken] = useState("SUI");
  const [toToken, setToToken] = useState("USDC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const balances = useCopilotStore((s) => s.balances);
  const currentPreview = useCopilotStore((s) => s.currentPreview);
  const { executeTransaction } = useTransactionExecution();
  const cancelPreview = () => useCopilotStore.setState({ currentPreview: null });

  const handleSwap = async () => {
    if (!walletAddress) return;
    setError("");
    setLoading(true);
    try {
      const response = await processIntent({
        message: `Swap ${amount} ${fromToken} to ${toToken}`,
        walletAddress,
        conversationHistory: [],
        balances,
        contacts: [],
      });
      if (response.type === "error") {
        setError(response.error?.message || "Swap failed");
      } else if (response.type === "preview" && response.preview) {
        useCopilotStore.setState({ currentPreview: response.preview });
      } else if (response.type === "clarification") {
        setError(response.clarification?.message || "Could not process swap");
      }
    } catch (e: any) {
      setError(e.message || "Failed to get swap route");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-start justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <h3 className="font-headline text-xl font-bold flex items-center gap-2">
          Swap
        </h3>

        <div className="glass-panel rounded-2xl p-6 space-y-5">
          {/* From */}
          <div className="space-y-2">
            <label className="block text-[10px] uppercase font-headline font-bold text-muted-foreground tracking-wider">From</label>
            <div className="flex gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d*\.?\d*$/.test(v)) setAmount(v);
                }}
                placeholder="0.00"
                className="flex-1 rounded-xl border border-[rgba(0,245,255,0.15)] bg-[#0d1515] px-4 py-3.5 text-lg font-mono text-foreground focus:outline-none focus:border-[#63f7ff]/50"
              />
              <TokenSelect value={fromToken} onChange={setFromToken} />
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full border border-[rgba(0,245,255,0.2)] flex items-center justify-center text-[#63f7ff]">
              ↓
            </div>
          </div>

          {/* To */}
          <div className="space-y-2">
            <label className="block text-[10px] uppercase font-headline font-bold text-muted-foreground tracking-wider">To</label>
            <TokenSelect value={toToken} onChange={setToToken} fullWidth />
          </div>

          {/* Error */}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Submit */}
          <button
            onClick={handleSwap}
            disabled={!amount || fromToken === toToken || loading || !walletAddress}
            className="w-full rounded-xl bg-[#63f7ff] py-3.5 font-headline font-bold text-sm text-[#002021] hover:bg-cyan-100 transition-all shadow-[0_0_15px_rgba(99,247,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Finding route..." : "Swap"}
          </button>
        </div>

        {/* Inline Preview */}
        {currentPreview && (
          <div className="glass-panel rounded-2xl p-4 space-y-3">
            <div className="space-y-1">
              {currentPreview.steps.map((s, i) => (
                <p key={i} className="text-xs text-muted-foreground">{s.description}</p>
              ))}
            </div>
            {currentPreview.risks.length > 0 && (
              <div className="text-xs text-yellow-400">{currentPreview.risks.map((r) => r.explanation).join("; ")}</div>
            )}
            <div className="flex gap-2">
              <button onClick={() => executeTransaction()} className="flex-1 rounded-xl bg-[#63f7ff] py-2.5 text-sm font-bold text-[#002021]">Confirm</button>
              <button onClick={cancelPreview} className="flex-1 rounded-xl border border-border/20 py-2.5 text-sm text-muted-foreground">Cancel</button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Or type in chat: &quot;swap {amount} {fromToken} to {toToken}&quot;
        </p>
      </div>
    </div>
  );
}

function TokenSelect({ value, onChange, fullWidth }: { value: string; onChange: (v: string) => void; fullWidth?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${fullWidth ? "w-full" : "w-[120px] flex-shrink-0"}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-xl border border-[rgba(0,245,255,0.15)] bg-[#0d1515] px-4 py-3.5 text-sm font-bold text-foreground focus:outline-none focus:border-[#63f7ff]/50 cursor-pointer"
      >
        {value}
        <span className="text-muted-foreground text-xs">▼</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-[rgba(0,245,255,0.15)] bg-[#0d1515] py-1 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          {TOKENS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { onChange(t); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#63f7ff]/10 transition-colors ${t === value ? "text-[#63f7ff] font-bold" : "text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

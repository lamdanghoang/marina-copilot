"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCopilotStore } from "@/store/copilot-store";

export default function SwapPage() {
  const [amount, setAmount] = useState("100");
  const [fromToken, setFromToken] = useState("USDC");
  const [toToken, setToToken] = useState("SUI");
  const router = useRouter();
  const sendMessage = useCopilotStore((s) => s.sendMessage);

  const handleSwap = () => {
    sendMessage(`Swap ${amount} ${fromToken} to ${toToken}`);
    router.push("/app");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h3 className="font-headline text-xl font-bold flex items-center gap-2">
        <span className="text-[#63f7ff]">🔄</span>
        Swap
      </h3>

      <div className="glass-panel p-6 rounded-2xl max-w-lg space-y-4">
        <div>
          <label className="block text-[10px] uppercase font-headline font-medium text-muted-foreground mb-1">From</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-[#0d1515] border border-[rgba(0,245,255,0.15)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#63f7ff]"
            />
            <select
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              className="bg-[#0d1515] border border-[rgba(0,245,255,0.15)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#63f7ff]"
            >
              <option value="SUI">SUI</option>
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
              <option value="WETH">WETH</option>
              <option value="CETUS">CETUS</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-headline font-medium text-muted-foreground mb-1">To</label>
          <select
            value={toToken}
            onChange={(e) => setToToken(e.target.value)}
            className="w-full bg-[#0d1515] border border-[rgba(0,245,255,0.15)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#63f7ff]"
          >
            <option value="SUI">SUI</option>
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="WETH">WETH</option>
            <option value="CETUS">CETUS</option>
          </select>
        </div>

        <button
          onClick={handleSwap}
          className="w-full bg-[#63f7ff] text-[#002021] py-3 rounded-xl font-headline font-bold text-sm hover:bg-cyan-100 transition-all shadow-[0_0_15px_rgba(99,247,255,0.2)]"
        >
          Generate AI Route Path
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Or just type in chat: &quot;swap 100 USDC to SUI&quot;
      </p>
    </div>
  );
}

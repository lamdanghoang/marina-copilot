"use client";

import { useCopilotStore } from "@/store/copilot-store";

export default function PortfolioPage() {
  const balances = useCopilotStore((s) => s.balances);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h3 className="font-headline text-xl font-bold flex items-center gap-2">
        
        Portfolio
      </h3>

      {/* Asset cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {balances.map((asset) => (
          <div key={asset.symbol} className="glass-panel p-6 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#63f7ff]/20 flex items-center justify-center text-xs font-bold text-[#63f7ff]">
                  {asset.symbol}
                </div>
                <div>
                  <h5 className="font-bold text-sm">{asset.symbol} Token</h5>
                  <p className="text-[10px] text-muted-foreground font-mono">Sui Network Asset</p>
                </div>
              </div>
              {asset.valueUsd && (
                <span className="text-xs text-green-400 font-bold font-mono">${asset.valueUsd.toFixed(2)}</span>
              )}
            </div>
            <div className="mt-2">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-headline">On-Chain Balance</p>
              <p className="text-2xl font-mono font-bold mt-1">{asset.balance.toLocaleString()} {asset.symbol}</p>
            </div>
          </div>
        ))}
        {balances.length === 0 && (
          <div className="glass-panel p-6 rounded-2xl col-span-2 text-center text-sm text-muted-foreground">
            Connect wallet to view portfolio
          </div>
        )}
      </div>

      {/* Yield info */}
      <div className="glass-panel p-5 rounded-2xl">
        <p className="font-headline text-xs text-[#63f7ff] font-bold tracking-wider mb-2">PERFORMANCE</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-mono font-black text-green-400">~4.2%</span>
          <span className="text-xs text-muted-foreground">APY Staking</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Stake SUI with high-APY validators. Ask Marina: &quot;stake 5 SUI&quot; to get started.
        </p>
      </div>
    </div>
  );
}

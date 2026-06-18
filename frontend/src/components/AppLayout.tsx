"use client";

import Link from "next/link";
import { useCopilotStore } from "@/store/copilot-store";
import { SpriteCharacter } from "@/components/SpriteCharacter";
import { ChatContainer } from "@/components/ChatContainer";
import { MemorySetup } from "@/components/MemorySetup";

function useCharacterAnimation(): string {
  const isProcessing = useCopilotStore((s) => s.isProcessing);
  const messages = useCopilotStore((s) => s.messages);
  const lastMsg = messages[messages.length - 1];
  if (isProcessing) return "thinking";
  if (lastMsg?.type === "success") return "happy";
  if (lastMsg?.type === "error") return "sad";
  if (lastMsg?.type === "preview") return "talking";
  if (lastMsg?.role === "assistant") return "talking";
  return "idle";
}

export function AppLayout() {
  const animation = useCharacterAnimation();
  const balances = useCopilotStore((s) => s.balances);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* LEFT SIDEBAR: Character + Memory */}
      <aside className="hidden lg:flex w-72 flex-col border-r border-[rgba(0,245,255,0.1)] bg-[#151d1d]/60 backdrop-blur-2xl p-4 gap-4 overflow-y-auto flex-shrink-0">
        {/* Character */}
        <div className="relative glass-panel rounded-2xl overflow-hidden flex items-center justify-center aspect-square">
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(99,247,255,0.08)_0%,transparent_70%)]" />
          <SpriteCharacter animation={animation} size={200} fps={6} />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-md px-3 py-1 rounded-full border border-[#63f7ff]/20">
            <span className="font-headline text-[9px] text-[#63f7ff] font-semibold tracking-wider">MARINA V2.4</span>
          </div>
        </div>

        {/* Memory Section */}
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-[10px] text-muted-foreground tracking-widest font-bold flex items-center gap-1.5">
              ⚙️ MEMORY
            </h3>
            <button
              onClick={() => useCopilotStore.getState().clearHistory()}
              className="text-[9px] font-headline text-muted-foreground/50 hover:text-red-400 transition-colors"
            >
              CLEAR CHAT
            </button>
          </div>

          {/* Memory tags placeholder */}
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-[#63f7ff]/5 border border-[#63f7ff]/20 px-2.5 py-1 rounded-full text-xs text-[#63f7ff]">
              💡 Cetus Priority
            </span>
            <span className="bg-[#63f7ff]/5 border border-[#63f7ff]/20 px-2.5 py-1 rounded-full text-xs text-[#63f7ff]">
              🛡️ Risk: Moderate
            </span>
          </div>

          {/* AI Context */}
          <div className="mt-auto p-3.5 glass-panel rounded-xl">
            <p className="font-headline text-[9px] text-muted-foreground font-bold mb-1">AI CONTEXT</p>
            <p className="text-xs text-foreground/80 leading-relaxed italic">
              &quot;Saved 1% slippage config for SUI swaps to ensure safe execution.&quot;
            </p>
          </div>
        </div>

        {/* Bottom links */}
        <div className="flex border-t border-[rgba(0,245,255,0.1)] pt-3 gap-2">
          <Link href="/app/settings" className="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl text-muted-foreground hover:bg-muted/30 transition-all text-xs">
            ⚙️
            <span className="font-headline text-[8px] font-bold tracking-widest">SETTINGS</span>
          </Link>
          <button className="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl text-muted-foreground hover:bg-muted/30 transition-all text-xs">
            📄
            <span className="font-headline text-[8px] font-bold tracking-widest">DOCS</span>
          </button>
        </div>
      </aside>

      {/* CENTER: Chat */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden border-r border-[rgba(0,245,255,0.1)]">
        <MemorySetup />
        <div className="flex-1 min-h-0">
          <ChatContainer />
        </div>
      </main>

      {/* RIGHT SIDEBAR: Portfolio */}
      <aside className="hidden xl:flex w-72 flex-col p-4 gap-4 overflow-y-auto flex-shrink-0">
        {/* Assets */}
        <div>
          <h3 className="font-headline text-[10px] text-muted-foreground tracking-widest font-bold mb-3">YOUR ASSETS</h3>
          <div className="space-y-3">
            {balances.map((b) => (
              <div key={b.symbol} className="glass-panel rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#63f7ff]/10 flex items-center justify-center text-sm font-bold text-[#63f7ff]">
                  {b.symbol.slice(0, 1)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">{b.symbol}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {b.symbol === "SUI" ? "Native Token" : "Stablecoin"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold">{b.balance.toLocaleString()}</p>
                  {b.valueUsd && (
                    <p className="text-[10px] text-green-400">
                      ${b.valueUsd.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {balances.length === 0 && (
              <div className="glass-panel rounded-xl p-4 text-center text-xs text-muted-foreground">
                Loading assets...
              </div>
            )}
          </div>
        </div>

        {/* Marina Insight */}
        <div className="mt-auto glass-panel rounded-xl p-4 border-[#63f7ff]/20">
          <p className="font-headline text-[9px] text-[#63f7ff] font-bold tracking-widest mb-2">MARINA INSIGHT</p>
          <p className="text-xs text-foreground/80 leading-relaxed">
            Connect your wallet and ask Marina to analyze your portfolio for optimization suggestions.
          </p>
        </div>
      </aside>
    </div>
  );
}

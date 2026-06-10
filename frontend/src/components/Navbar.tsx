"use client";

import { WalletButton } from "@/components/WalletButton";
import { useCopilotStore } from "@/store/copilot-store";

export function Navbar() {
  const walletAddress = useCopilotStore((s) => s.walletAddress);

  return (
    <nav className="sticky top-0 z-50 flex h-16 items-center justify-between px-6 bg-[#192121]/70 backdrop-blur-xl border-b border-[rgba(0,245,255,0.1)] shadow-[0_0_15px_rgba(0,245,255,0.1)]">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="font-headline text-2xl font-bold text-[#63f7ff] tracking-tight">Marina</span>
          <span className="font-headline text-[10px] text-muted-foreground opacity-60 px-1.5 py-0.5 rounded border border-[rgba(0,245,255,0.15)] tracking-widest bg-background">
            COPILOT
          </span>
        </div>

        {/* Nav tabs (only when connected) */}
        {walletAddress && (
          <div className="hidden md:flex gap-6 ml-8">
            <NavTab label="Chat" active />
            <NavTab label="Portfolio" />
            <NavTab label="Swap" />
            <NavTab label="Safety" />
          </div>
        )}
      </div>

      <WalletButton />
    </nav>
  );
}

function NavTab({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={`text-sm font-medium transition-colors pb-1 border-b-2 hover:text-[#63f7ff] ${
        active
          ? "border-[#63f7ff] text-[#63f7ff]"
          : "border-transparent text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

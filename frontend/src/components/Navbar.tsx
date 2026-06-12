"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { WalletButton } from "@/components/WalletButton";
import { useCopilotStore } from "@/store/copilot-store";

export function Navbar() {
  const [mounted, setMounted] = useState(false);
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const account = useCurrentAccount();
  const pathname = usePathname();
  const path = pathname as string;

  useEffect(() => { setMounted(true); }, []);

  const isAppRoute = path.startsWith("/app");
  const isConnected = mounted && (!!walletAddress || !!account?.address || !!localStorage.getItem("zklogin_address"));
  const showTabs = isAppRoute && isConnected;

  return (
    <nav className="sticky top-0 z-50 flex h-16 items-center justify-between px-6 bg-[#192121]/70 backdrop-blur-xl border-b border-[rgba(0,245,255,0.1)] shadow-[0_0_15px_rgba(0,245,255,0.1)]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-headline text-2xl font-bold text-[#63f7ff] tracking-tight">Marina</span>
          <span className="font-headline text-[10px] text-muted-foreground opacity-60 px-1.5 py-0.5 rounded border border-[rgba(0,245,255,0.15)] tracking-widest bg-background">
            COPILOT
          </span>
        </div>

        {showTabs && (
          <div className="hidden md:flex gap-6 ml-8">
            <NavTab label="Chat" href="/app" active={path === "/app"} />
            <NavTab label="Portfolio" href="/app/portfolio" active={path === "/app/portfolio"} />
            <NavTab label="Swap" href="/app/swap" active={path === "/app/swap"} />
            <NavTab label="Safety" href="/app/safety" active={path === "/app/safety"} />
          </div>
        )}
      </div>

      {mounted && (
        isAppRoute && isConnected ? <WalletButton /> : (
          <Link
            href="/app"
            className="flex items-center gap-2 rounded-xl bg-[#63f7ff] px-5 py-2.5 text-sm font-bold text-[#002021] hover:bg-cyan-100 transition-all shadow-[0_0_15px_rgba(99,247,255,0.2)]"
          >
            Launch App
          </Link>
        )
      )}
    </nav>
  );
}

function NavTab({ label, href, active }: { label: string; href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors pb-1 border-b-2 hover:text-[#63f7ff] ${
        active ? "border-[#63f7ff] text-[#63f7ff]" : "border-transparent text-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

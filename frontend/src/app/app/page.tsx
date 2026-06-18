"use client";

import { useState, useEffect } from "react";
import { useWallets, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { useCopilotStore } from "@/store/copilot-store";
import { useZkLoginSession } from "@/hooks/useZkLoginSession";
import { AppLayout } from "@/components/AppLayout";
import { ZkLoginButton } from "@/components/ZkLoginButton";

export default function AppPage() {
  const [mounted, setMounted] = useState(false);
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const account = useCurrentAccount();
  useZkLoginSession();

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return <div style={{ minHeight: "100vh", background: "#0A0F1E" }} />;
  }

  const hasPendingZk = !!localStorage.getItem("zklogin_address");
  const isConnected = !!walletAddress || !!account?.address || hasPendingZk;
  const isDetecting = hasPendingZk && !walletAddress;

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      <div className={isConnected ? "h-full" : "pointer-events-none opacity-30 blur-sm h-full"}>
        <AppLayout />
      </div>
      {!isConnected && <ConnectOverlay />}
      {isDetecting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0A0F1E]">
          <div className="animate-pulse text-[#63f7ff] text-sm">Loading session...</div>
        </div>
      )}
    </div>
  );
}

function ConnectOverlay() {
  const wallets = useWallets();
  const dAppKit = useDAppKit();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-8 shadow-[0_0_60px_rgba(99,247,255,0.1)]">
        <div className="text-center mb-6">
          <img src="/marina-logo.png" alt="Marina" className="w-16 h-16 rounded-full mx-auto" />
          <h2 className="font-headline text-xl font-bold mt-3">Connect to Marina</h2>
          <p className="text-xs text-muted-foreground mt-2">Choose your preferred login method</p>
        </div>

        {/* Wallet options */}
        <div className="space-y-3 mb-4">
          {wallets.map((wallet) => (
            <button
              key={wallet.name}
              onClick={() => (dAppKit as any).connectWallet({ wallet })}
              className="flex w-full items-center gap-3 rounded-xl border border-[rgba(0,245,255,0.15)] p-4 hover:bg-muted/30 transition-colors"
            >
              {wallet.icon && <img src={wallet.icon} alt={wallet.name} className="w-8 h-8 rounded-lg" />}
              <span className="font-medium text-sm">{wallet.name}</span>
            </button>
          ))}
          {wallets.length === 0 && (
            <div className="rounded-xl border border-[rgba(0,245,255,0.1)] p-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">No wallets detected</p>
              <a href="https://suiwallet.com/" target="_blank" rel="noopener noreferrer" className="text-xs text-[#63f7ff] hover:underline">
                Install Sui Wallet →
              </a>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-[rgba(0,245,255,0.1)]" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-[rgba(0,245,255,0.1)]" />
        </div>

        {/* zkLogin */}
        <ZkLoginButton />
      </div>
    </div>
  );
}

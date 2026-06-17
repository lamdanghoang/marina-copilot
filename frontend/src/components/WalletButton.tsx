"use client";

import { useState, useEffect } from "react";
import { useCurrentAccount, useWallets, useDAppKit, useCurrentClient } from "@mysten/dapp-kit-react";
import { useCopilotStore } from "@/store/copilot-store";
import { useZkLoginSession } from "@/hooks/useZkLoginSession";
import { truncateAddress, formatBalance } from "@/lib/formatting";

interface WalletButtonProps {
  className?: string;
  variant?: "navbar" | "hero";
}

export function WalletButton({ className, variant = "navbar" }: WalletButtonProps) {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const dAppKit = useDAppKit();
  const client = useCurrentClient();
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const { isZkLogin, logout: zkLogout } = useZkLoginSession();
  const [balance, setBalance] = useState<string | null>(null);

  // Fetch balance
  useEffect(() => {
    if (!account?.address || !client) return;
    (client as any).getBalance({ owner: account.address }).then((res: any) => {
      const raw = BigInt(res?.balance?.balance ?? res?.totalBalance ?? "0");
      setBalance(formatBalance(raw, 9, 2));
    }).catch(() => {});
  }, [account?.address, client]);

  // Connected via zkLogin
  if (isZkLogin && walletAddress) {
    return (
      <div className={`flex items-center gap-3 ${className ?? ""}`}>
        <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-400 font-bold tracking-wider">zkLogin</span>
        <span className="font-mono text-xs text-[#63f7ff]">{truncateAddress(walletAddress)}</span>
        <button
          onClick={zkLogout}
          className="rounded-lg border border-[rgba(0,245,255,0.2)] px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Connected via wallet extension
  if (account?.address) {
    return (
      <div className={`flex items-center gap-3 ${className ?? ""}`}>
        <span className="font-mono text-xs text-[#63f7ff]">{truncateAddress(account.address)}</span>
        {balance && (
          <div className="flex items-center gap-1.5 rounded-full border border-[rgba(0,245,255,0.2)] bg-[#232b2c] px-3 py-1.5">
            <span className="text-xs font-bold text-[#63f7ff]">{balance} SUI</span>
          </div>
        )}
        <button
          onClick={() => (dAppKit as any).disconnectWallet()}
          className="rounded-lg border border-[rgba(0,245,255,0.2)] px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Not connected
  if (variant === "hero") return null;

  return (
    <div className={`${className ?? ""}`}>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("open-connect-modal"))}
        className="flex items-center gap-2 rounded-xl bg-[#63f7ff] px-5 py-2.5 text-sm font-bold text-[#002021] hover:bg-cyan-100 transition-all shadow-[0_0_15px_rgba(99,247,255,0.2)]"
      >
        Launch App
      </button>
    </div>
  );
}

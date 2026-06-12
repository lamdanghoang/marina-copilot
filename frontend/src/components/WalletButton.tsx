"use client";

import { useConnectWallet, useWallets, useCurrentAccount, useDisconnectWallet, useSuiClientQuery } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { useCopilotStore } from "@/store/copilot-store";
import { useZkLoginSession } from "@/hooks/useZkLoginSession";
import { truncateAddress, formatBalance } from "@/lib/formatting";

interface WalletButtonProps {
  className?: string;
  variant?: "navbar" | "hero";
}

export function WalletButton({ className, variant = "navbar" }: WalletButtonProps) {
  const [showWalletList, setShowWalletList] = useState(false);
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutate: connect, isPending } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();
  const connectWallet = useCopilotStore((s) => s.connectWallet);
  const disconnectWallet = useCopilotStore((s) => s.disconnectWallet);
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const { isZkLogin, logout: zkLogout } = useZkLoginSession();

  const { data: balanceData } = useSuiClientQuery(
    "getBalance",
    { owner: account?.address ?? "" },
    { enabled: !!account?.address }
  );

  // Sync dapp-kit wallet state with copilot store
  useEffect(() => {
    if (account?.address && balanceData) {
      const rawBalance = BigInt(balanceData.totalBalance);
      const formattedBalance = Number(formatBalance(rawBalance, 9, 2));
      connectWallet(account.address, [
        { token: "0x2::sui::SUI", symbol: "SUI", balance: formattedBalance, decimals: 9 },
      ]);
    } else if (!account && !isZkLogin) {
      disconnectWallet();
    }
  }, [account, balanceData, connectWallet, disconnectWallet, isZkLogin]);

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
  if (account?.address && balanceData) {
    return (
      <div className={`flex items-center gap-3 ${className ?? ""}`}>
        <span className="font-mono text-xs text-[#63f7ff]">{truncateAddress(account.address)}</span>
        <div className="flex items-center gap-1.5 rounded-full border border-[rgba(0,245,255,0.2)] bg-[#232b2c] px-3 py-1.5">
          <span className="text-xs font-bold text-[#63f7ff]">
            {formatBalance(BigInt(balanceData.totalBalance), 9, 2)} SUI
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="rounded-lg border border-[rgba(0,245,255,0.2)] px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Not connected — Launch App button that opens modal
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

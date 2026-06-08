"use client";

import { ConnectButton, useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { useEffect } from "react";
import { useCopilotStore } from "@/store/copilot-store";
import { useZkLoginSession } from "@/hooks/useZkLoginSession";
import { ZkLoginButton } from "@/components/ZkLoginButton";
import { truncateAddress, formatBalance } from "@/lib/formatting";

interface WalletButtonProps {
  className?: string;
}

export function WalletButton({ className }: WalletButtonProps) {
  const account = useCurrentAccount();
  const connectWallet = useCopilotStore((s) => s.connectWallet);
  const disconnectWallet = useCopilotStore((s) => s.disconnectWallet);
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const { isZkLogin, logout: zkLogout } = useZkLoginSession();

  // Fetch SUI balance for the connected dapp-kit account
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

  // If connected via zkLogin
  if (isZkLogin && walletAddress) {
    return (
      <div className={`flex items-center gap-3 ${className ?? ""}`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-600">zkLogin</span>
          <span className="font-mono">{truncateAddress(walletAddress)}</span>
        </div>
        <button
          onClick={zkLogout}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // If connected via wallet extension
  if (account?.address && balanceData) {
    return (
      <div className={`flex items-center gap-3 ${className ?? ""}`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{truncateAddress(account.address)}</span>
          <span className="font-medium text-foreground">
            {formatBalance(BigInt(balanceData.totalBalance), 9, 2)} SUI
          </span>
        </div>
        <ConnectButton />
      </div>
    );
  }

  // Not connected — show both options
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <ZkLoginButton />
      <div className="text-xs text-muted-foreground">or</div>
      <ConnectButton />
    </div>
  );
}

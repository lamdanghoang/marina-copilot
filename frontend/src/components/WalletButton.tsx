"use client";

import { ConnectButton, useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { useEffect } from "react";
import { useCopilotStore } from "@/store/copilot-store";
import { truncateAddress, formatBalance } from "@/lib/formatting";

interface WalletButtonProps {
  className?: string;
}

export function WalletButton({ className }: WalletButtonProps) {
  const account = useCurrentAccount();
  const connectWallet = useCopilotStore((s) => s.connectWallet);
  const disconnectWallet = useCopilotStore((s) => s.disconnectWallet);

  // Fetch SUI balance for the connected account
  const { data: balanceData } = useSuiClientQuery(
    "getBalance",
    { owner: account?.address ?? "" },
    { enabled: !!account?.address }
  );

  // Sync wallet state with copilot store
  useEffect(() => {
    if (account?.address && balanceData) {
      const rawBalance = BigInt(balanceData.totalBalance);
      const formattedBalance = Number(formatBalance(rawBalance, 9, 2));

      connectWallet(account.address, [
        {
          token: "0x2::sui::SUI",
          symbol: "SUI",
          balance: formattedBalance,
          decimals: 9,
        },
      ]);
    } else if (!account) {
      disconnectWallet();
    }
  }, [account, balanceData, connectWallet, disconnectWallet]);

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      {account?.address && balanceData && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{truncateAddress(account.address)}</span>
          <span className="text-foreground font-medium">
            {formatBalance(BigInt(balanceData.totalBalance), 9, 2)} SUI
          </span>
        </div>
      )}
      <ConnectButton />
    </div>
  );
}

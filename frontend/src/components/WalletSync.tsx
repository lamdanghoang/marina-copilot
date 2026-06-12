"use client";

import { useEffect } from "react";
import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { useCopilotStore } from "@/store/copilot-store";
import { formatBalance } from "@/lib/formatting";
import { useZkLoginSession } from "@/hooks/useZkLoginSession";

/**
 * Global wallet state sync — place in layout.
 * Syncs dapp-kit account + balance into Zustand store.
 */
export function WalletSync() {
  const account = useCurrentAccount();
  const connectWallet = useCopilotStore((s) => s.connectWallet);
  const disconnectWallet = useCopilotStore((s) => s.disconnectWallet);
  const { isZkLogin } = useZkLoginSession();

  const { data: balanceData } = useSuiClientQuery(
    "getBalance",
    { owner: account?.address ?? "" },
    { enabled: !!account?.address }
  );

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

  return null;
}

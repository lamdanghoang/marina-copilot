"use client";

import { useEffect } from "react";
import { useCurrentAccount, useCurrentClient } from "@mysten/dapp-kit-react";
import { useCopilotStore } from "@/store/copilot-store";
import { formatBalance } from "@/lib/formatting";
import { useZkLoginSession } from "@/hooks/useZkLoginSession";
import { loadCredentials } from "@/hooks/useMemwalSetup";

export function WalletSync() {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const connectWallet = useCopilotStore((s) => s.connectWallet);
  const disconnectWallet = useCopilotStore((s) => s.disconnectWallet);
  const setMemwalCredentials = useCopilotStore((s) => s.setMemwalCredentials);
  const memwalCredentials = useCopilotStore((s) => s.memwalCredentials);
  const { isZkLogin } = useZkLoginSession();

  // Sync wallet + balance
  useEffect(() => {
    if (!account?.address) {
      if (!isZkLogin) disconnectWallet();
      return;
    }

    // Always set wallet address immediately (even before balance loads)
    connectWallet(account.address, []);

    if (!client) return;

    (client as any).getBalance({ owner: account.address }).then((res: any) => {
      const bal = res?.balance?.balance ?? res?.balance?.coinBalance ?? res?.totalBalance ?? "0";
      const raw = BigInt(bal);
      const formattedBalance = Number(formatBalance(raw, 9, 2));
      connectWallet(account.address, [
        { token: "0x2::sui::SUI", symbol: "SUI", balance: formattedBalance, decimals: 9 },
      ]);
    }).catch((e: any) => {
      console.error("[WalletSync] getBalance error:", e);
    });
  }, [account?.address, client, connectWallet, disconnectWallet, isZkLogin]);

  // Sync memwal credentials
  useEffect(() => {
    const addr = account?.address;
    if (addr && !memwalCredentials) {
      const saved = loadCredentials(addr);
      if (saved) setMemwalCredentials(saved);
    }
  }, [account?.address, memwalCredentials, setMemwalCredentials]);

  return null;
}

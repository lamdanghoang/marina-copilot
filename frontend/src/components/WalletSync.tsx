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

    const addr = account.address;
    const WAL_TYPE = "0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL";
    const USDC_TYPE = "0xa1ec7fc00a6f40db9693571b57fdd7d48add54f290e3f8023143e6d4a4e6bef3::usdc::USDC";

    Promise.all([
      (client as any).getBalance({ owner: addr }).catch(() => null),
      (client as any).getBalance({ owner: addr, coinType: WAL_TYPE }).catch(() => null),
      (client as any).getBalance({ owner: addr, coinType: USDC_TYPE }).catch(() => null),
    ]).then(([suiRes, walRes, usdcRes]: any[]) => {
      const balances: { token: string; symbol: string; balance: number; decimals: number }[] = [];

      const suiBal = BigInt(suiRes?.balance?.balance ?? suiRes?.balance?.coinBalance ?? suiRes?.totalBalance ?? "0");
      if (suiBal > BigInt(0)) balances.push({ token: "0x2::sui::SUI", symbol: "SUI", balance: Number(formatBalance(suiBal, 9, 2)), decimals: 9 });

      const walBal = BigInt(walRes?.balance?.balance ?? walRes?.balance?.coinBalance ?? walRes?.totalBalance ?? "0");
      if (walBal > BigInt(0)) balances.push({ token: WAL_TYPE, symbol: "WAL", balance: Number(formatBalance(walBal, 9, 2)), decimals: 9 });

      const usdcBal = BigInt(usdcRes?.balance?.balance ?? usdcRes?.balance?.coinBalance ?? usdcRes?.totalBalance ?? "0");
      if (usdcBal > BigInt(0)) balances.push({ token: USDC_TYPE, symbol: "USDC", balance: Number(formatBalance(usdcBal, 6, 2)), decimals: 6 });

      connectWallet(addr, balances.length > 0 ? balances : [{ token: "0x2::sui::SUI", symbol: "SUI", balance: Number(formatBalance(suiBal, 9, 2)), decimals: 9 }]);
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

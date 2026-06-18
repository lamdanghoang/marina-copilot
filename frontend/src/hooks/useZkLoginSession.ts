"use client";

import { useEffect, useState } from "react";

import { useCopilotStore } from "@/store/copilot-store";
import { secureGet, secureClearAll } from "@/lib/secure-storage";
import { formatBalance } from "@/lib/formatting";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { networkConfig } from "@/lib/config";

/**
 * Hook that detects zkLogin session from localStorage and syncs wallet state.
 * Returns logout function for zkLogin users.
 */
export function useZkLoginSession() {
  const [isZkLogin, setIsZkLogin] = useState(false);
  const suiClient = new SuiGrpcClient({ network: networkConfig.network, baseUrl: networkConfig.rpcUrl } as any);
  const connectWallet = useCopilotStore((s) => s.connectWallet);
  const disconnectWallet = useCopilotStore((s) => s.disconnectWallet);
  const walletAddress = useCopilotStore((s) => s.walletAddress);

  useEffect(() => {
    // Small delay to ensure storage is ready after redirect
    const timer = setTimeout(() => checkZkLoginSession(), 100);
    return () => clearTimeout(timer);
  }, []);

  const checkZkLoginSession = async () => {
    const address = localStorage.getItem("zklogin_address");
    if (!address) return;

    const jwt = localStorage.getItem("zklogin_jwt");
    if (!jwt) {
      localStorage.removeItem("zklogin_address");
      return;
    }

    try {
      const payload = JSON.parse(atob(jwt.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) {
        // JWT expired
        logout();
        return;
      }
    } catch {
      logout();
      return;
    }

    // Fetch balance and connect
    setIsZkLogin(true);
    try {
      const balanceData = await (suiClient as any).getBalance({ owner: address });
      const bal = balanceData?.balance?.balance ?? balanceData?.balance?.coinBalance ?? balanceData?.totalBalance ?? "0";
      const rawBalance = BigInt(bal);
      const formattedBalance = Number(formatBalance(rawBalance, 9, 2));

      connectWallet(address, [
        { token: "0x2::sui::SUI", symbol: "SUI", balance: formattedBalance, decimals: 9 },
      ]);
    } catch {
      connectWallet(address, []);
    }

    // Load memwal credentials from localStorage
    try {
      const { loadCredentials } = await import("@/hooks/useMemwalSetup");
      const creds = loadCredentials(address);
      if (creds) useCopilotStore.getState().setMemwalCredentials(creds);
    } catch {}
  };

  const logout = () => {
    secureClearAll();
    localStorage.removeItem("zklogin_address");
    setIsZkLogin(false);
    disconnectWallet();
  };

  return { isZkLogin, logout };
}

"use client";

import { useCallback, useState } from "react";
import { useDAppKit, useCurrentClient, useCurrentAccount } from "@mysten/dapp-kit-react";
import { generateDelegateKey } from "@mysten-incubation/memwal/account";
import { networkConfig } from "@/lib/config";
import { findMemwalAccount } from "@/lib/sui-graphql";

const MEMWAL_PACKAGE_ID = "0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6";
const MEMWAL_REGISTRY_ID = "0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437";
const STORAGE_KEY = "marina-copilot-memwal";

export interface MemwalCredentials {
  accountId: string;
  delegateKey: string;
}

export function loadCredentials(walletAddress: string): MemwalCredentials | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${walletAddress}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCredentials(walletAddress: string, creds: MemwalCredentials) {
  localStorage.setItem(`${STORAGE_KEY}-${walletAddress}`, JSON.stringify(creds));
}

export function useMemwalSetup(walletAddress: string | null) {
  const [isSettingUp, setIsSettingUp] = useState(false);
  const suiClient = useCurrentClient();
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();

  const setup = useCallback(async (): Promise<MemwalCredentials | null> => {
    if (!walletAddress) return null;
    setIsSettingUp(true);

    try {
      const delegate = await generateDelegateKey();
      const { isZkLoginSession, signAndExecuteZkLogin } = await import("@/lib/zklogin-signer");
      const useZk = !account && isZkLoginSession();

      const walletSigner = {
        address: walletAddress,
        signAndExecuteTransaction: async (input: { transaction: any }) => {
          if (useZk) {
            const res = await signAndExecuteZkLogin({ transaction: input.transaction });
            const digest = (res as any)?.Transaction?.digest ?? (res as any)?.digest ?? "";
            return { digest };
          }
          const res = await (dAppKit as any).signAndExecuteTransaction({ transaction: input.transaction });
          const digest = (res as any)?.Transaction?.digest ?? (res as any)?.digest ?? "";
          return { digest };
        },
        signPersonalMessage: async (input: { message: Uint8Array }) => {
          if (useZk) {
            // zkLogin doesn't support signPersonalMessage — use ephemeral key directly
            const { getStoredZkLoginState } = await import("@/lib/zklogin");
            const state = await getStoredZkLoginState();
            if (!state) throw new Error("No zkLogin session");
            const { signature } = await state.ephemeralKeyPair.signPersonalMessage(input.message);
            return { signature };
          }
          const res = await (dAppKit as any).signPersonalMessage({ message: input.message });
          return { signature: res.signature };
        },
      };

      // Check if account already exists via GraphQL
      let accountId: string | null = null;
      try {
        const found = await findMemwalAccount(MEMWAL_PACKAGE_ID, walletAddress);
        if (found) accountId = found.accountId;
      } catch (e) {
        console.warn("[MemWal] GraphQL query failed:", e);
      }

      // Only create if not exists
      if (!accountId) {
        // Build create_account tx manually (SDK createAccount needs effects we can't provide)
        const { Transaction } = await import("@mysten/sui/transactions");
        const tx = new Transaction();
        tx.moveCall({
          target: `${MEMWAL_PACKAGE_ID}::account::create_account`,
          arguments: [tx.object(MEMWAL_REGISTRY_ID), tx.object("0x6")],
        });
        await walletSigner.signAndExecuteTransaction({ transaction: tx });

        // Wait + query GraphQL to get real accountId
        await new Promise((r) => setTimeout(r, 3000));
        const found = await findMemwalAccount(MEMWAL_PACKAGE_ID, walletAddress);
        if (found) accountId = found.accountId;
        if (!accountId) throw new Error("Account created but could not find on-chain");
      }

      // Add delegate key manually (SDK addDelegateKey also needs effects we can't provide)
      const { Transaction: Tx } = await import("@mysten/sui/transactions");
      const tx2 = new Tx();
      tx2.moveCall({
        target: `${MEMWAL_PACKAGE_ID}::account::add_delegate_key`,
        arguments: [
          tx2.object(accountId),
          tx2.pure.vector("u8", Array.from(delegate.publicKey)),
          tx2.pure.address(delegate.suiAddress),
          tx2.pure.string("Marina Copilot"),
          tx2.object("0x6"),
        ],
      });
      await walletSigner.signAndExecuteTransaction({ transaction: tx2 });

      const creds: MemwalCredentials = {
        accountId,
        delegateKey: delegate.privateKey,
      };
      saveCredentials(walletAddress, creds);

      // Update global store
      const { useCopilotStore } = await import("@/store/copilot-store");
      useCopilotStore.getState().setMemwalCredentials(creds);

      return creds;
    } catch (error) {
      console.error("[MemWal Setup] Failed:", error);
      return null;
    } finally {
      setIsSettingUp(false);
    }
  }, [walletAddress, dAppKit, suiClient]);

  return { isSettingUp, setup };
}

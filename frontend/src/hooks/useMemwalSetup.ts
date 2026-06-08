"use client";

import { useCallback, useState } from "react";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { generateDelegateKey } from "@mysten-incubation/memwal/account";

// Staging (testnet) contract IDs
const MEMWAL_PACKAGE_ID =
  "0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6";
const MEMWAL_REGISTRY_ID =
  "0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437";

const STORAGE_KEY = "defi-copilot-memwal";

export interface MemwalCredentials {
  accountId: string;
  delegateKey: string;
}

/**
 * Load saved credentials from localStorage.
 */
export function loadCredentials(walletAddress: string): MemwalCredentials | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${walletAddress}`);
    if (!raw) return null;
    return JSON.parse(raw) as MemwalCredentials;
  } catch {
    return null;
  }
}

/**
 * Save credentials to localStorage.
 */
function saveCredentials(walletAddress: string, creds: MemwalCredentials): void {
  localStorage.setItem(`${STORAGE_KEY}-${walletAddress}`, JSON.stringify(creds));
}

/**
 * Hook that handles MemWal account setup (create account + add delegate key).
 */
export function useMemwalSetup(walletAddress: string | null) {
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [credentials, setCredentials] = useState<MemwalCredentials | null>(() =>
    walletAddress ? loadCredentials(walletAddress) : null
  );
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);

  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  /**
   * Check if user already has a MemWalAccount on-chain.
   */
  const checkAccount = useCallback(async () => {
    if (!walletAddress) return;

    // If credentials exist locally, we're good
    const saved = loadCredentials(walletAddress);
    if (saved) {
      setCredentials(saved);
      setHasAccount(true);
      return;
    }

    // Check on-chain via registry
    try {
      const result = await suiClient.devInspectTransactionBlock({
        sender: walletAddress,
        transactionBlock: (() => {
          const tx = new Transaction();
          tx.moveCall({
            target: `${MEMWAL_PACKAGE_ID}::account::has_account`,
            arguments: [
              tx.object(MEMWAL_REGISTRY_ID),
              tx.pure.address(walletAddress),
            ],
          });
          return tx;
        })() as unknown as Parameters<typeof suiClient.devInspectTransactionBlock>[0]["transactionBlock"],
      });

      // Parse result - if account exists but no local key, user needs to re-authorize
      const returnValues = result.results?.[0]?.returnValues;
      const exists =
        returnValues &&
        returnValues[0] &&
        returnValues[0][0]?.[0] === 1;

      setHasAccount(!!exists);
    } catch {
      setHasAccount(false);
    }
  }, [walletAddress, suiClient]);

  /**
   * Setup MemWal: create account + generate delegate key + register on-chain.
   */
  const setup = useCallback(async (): Promise<MemwalCredentials | null> => {
    if (!walletAddress) return null;
    setIsSettingUp(true);

    try {
      // 1. Generate delegate keypair
      const delegate = await generateDelegateKey();

      // 2. Build PTB: create_account + add_delegate_key
      const tx = new Transaction();

      // Create account
      tx.moveCall({
        target: `${MEMWAL_PACKAGE_ID}::account::create_account`,
        arguments: [tx.object(MEMWAL_REGISTRY_ID), tx.object("0x6")],
      });

      // We need the account object ID after creation - use a two-step approach
      // Actually create_account creates a shared object, we can't reference it in same PTB
      // So we do it in 2 transactions, or check if account already exists

      // If account already exists on-chain (but no local key), just add delegate key
      // For simplicity: try create_account, if it fails with EAccountAlreadyExists, skip

      const result = await signAndExecute({
        transaction: tx as unknown as Parameters<typeof signAndExecute>[0]["transaction"],
      });

      // Wait for the account to be created, then get accountId
      await new Promise((r) => setTimeout(r, 2000));

      // Query the user's MemWalAccount object
      const objects = await suiClient.getOwnedObjects({
        owner: walletAddress,
        filter: {
          StructType: `${MEMWAL_PACKAGE_ID}::account::MemWalAccount`,
        },
      });

      let accountId: string | null = null;

      if (objects.data.length > 0) {
        accountId = objects.data[0].data?.objectId ?? null;
      }

      if (!accountId) {
        // Try querying differently - MemWalAccount is shared, not owned
        // Need to find it via events
        const events = await suiClient.queryEvents({
          query: {
            MoveEventType: `${MEMWAL_PACKAGE_ID}::account::AccountCreated`,
          },
          limit: 5,
          order: "descending",
        });

        for (const event of events.data) {
          const parsed = event.parsedJson as { owner?: string; account_id?: string };
          if (parsed.owner === walletAddress) {
            accountId = parsed.account_id ?? null;
            break;
          }
        }
      }

      if (!accountId) {
        throw new Error("Could not find created MemWalAccount");
      }

      // 3. Add delegate key in a second transaction
      const tx2 = new Transaction();
      tx2.moveCall({
        target: `${MEMWAL_PACKAGE_ID}::account::add_delegate_key`,
        arguments: [
          tx2.object(accountId),
          tx2.pure.vector("u8", Array.from(delegate.publicKey)),
          tx2.pure.address(delegate.suiAddress),
          tx2.pure.string("DeFi Copilot"),
          tx2.object("0x6"),
        ],
      });

      await signAndExecute({
        transaction: tx2 as unknown as Parameters<typeof signAndExecute>[0]["transaction"],
      });

      // 4. Save credentials
      const creds: MemwalCredentials = {
        accountId,
        delegateKey: delegate.privateKey,
      };
      saveCredentials(walletAddress, creds);
      setCredentials(creds);
      setHasAccount(true);

      return creds;
    } catch (error) {
      console.error("[MemWal Setup] Failed:", error);
      return null;
    } finally {
      setIsSettingUp(false);
    }
  }, [walletAddress, signAndExecute, suiClient]);

  return { credentials, hasAccount, isSettingUp, checkAccount, setup };
}

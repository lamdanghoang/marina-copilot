// ============================================================
// Marina Copilot — Memory Service
// Per-user MemWal accounts with InMemory fallback
// Graceful degradation: recall → empty array, remember → silent fail
// ============================================================

import { MemWal } from "@mysten-incubation/memwal";
import { MemoryRecord, MemoryContent } from "../types";
import { config } from "../lib/config";

// --- Per-User Credentials ---

export interface UserMemwalCredentials {
  accountId: string;
  delegateKey: string;
}

// --- MemWal Client Factory (per-user, not singleton) ---

function createMemWalClient(creds: UserMemwalCredentials): ReturnType<typeof MemWal.create> {
  return MemWal.create({
    key: creds.delegateKey,
    accountId: creds.accountId,
    serverUrl: config.memwal.serverUrl,
    namespace: "marina-copilot",
  });
}

// --- InMemory Fallback (Development / No credentials) ---

const memoryStore = new Map<string, MemoryRecord[]>();
const MAX_TRANSACTION_MEMORIES = 50;

// --- Timeout Wrapper ---

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error("Operation timed out"));
        });
      }),
    ]);
    clearTimeout(timeoutId);
    return result;
  } catch {
    clearTimeout(timeoutId);
    return fallback;
  }
}

// --- MemWal-backed operations ---

async function recallFromMemWal(
  creds: UserMemwalCredentials,
  context: string,
  limit: number
): Promise<MemoryRecord[]> {
  const client = createMemWalClient(creds);
  const result = await client.recall({ query: context, limit });

  if (!result.results || result.results.length === 0) return [];

  return result.results.map((item: { text: string; blob_id: string; distance: number }, idx: number) => {
    let parsed: Partial<MemoryRecord> = {};
    try {
      parsed = JSON.parse(item.text);
    } catch {
      // Plain text memory
    }

    return {
      id: parsed.id || `memwal_${idx}_${Date.now()}`,
      type: parsed.type || "transaction",
      content: parsed.content || item.text,
      timestamp: parsed.timestamp || Date.now(),
      metadata: parsed.metadata,
    } as MemoryRecord;
  });
}

async function rememberToMemWal(
  creds: UserMemwalCredentials,
  record: MemoryRecord
): Promise<void> {
  const client = createMemWalClient(creds);
  const payload = JSON.stringify({
    id: record.id,
    type: record.type,
    content: record.content,
    timestamp: record.timestamp,
    metadata: record.metadata,
  });

  await client.remember(payload);
}

// --- InMemory fallback operations ---

function recallFromMemory(walletAddress: string, limit: number): MemoryRecord[] {
  const memories = memoryStore.get(walletAddress) || [];
  return [...memories].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

function rememberToMemory(walletAddress: string, record: MemoryRecord): void {
  const existing = memoryStore.get(walletAddress) || [];
  existing.push(record);
  memoryStore.set(walletAddress, existing);
}

// --- Public API ---

/**
 * Recall memories for a wallet address.
 * Uses per-user MemWal credentials if provided, otherwise InMemory fallback.
 */
export async function recall(
  walletAddress: string,
  context: string,
  limit: number = 10,
  creds?: UserMemwalCredentials
): Promise<MemoryRecord[]> {
  try {
    if (creds) {
      return await withTimeout(
        recallFromMemWal(creds, context, limit),
        config.memwal.timeoutMs,
        [] as MemoryRecord[]
      );
    }
    return recallFromMemory(walletAddress, limit);
  } catch (error) {
    console.error("[Memory] Recall failed:", error);
    return [];
  }
}

/**
 * Store a memory record.
 * Uses per-user MemWal credentials if provided, otherwise InMemory fallback.
 */
export async function remember(
  walletAddress: string,
  content: MemoryContent,
  creds?: UserMemwalCredentials
): Promise<void> {
  try {
    const record: MemoryRecord = {
      id: generateId(),
      type: content.type,
      content: content.content,
      timestamp: Date.now(),
      metadata: content.metadata,
    };

    if (creds) {
      // Preference overwrite: store new one (MemWal's vector similarity
      // naturally ranks the newest preference highest on recall)
      await withTimeout(
        rememberToMemWal(creds, record),
        config.memwal.timeoutMs,
        undefined
      );
    } else {
      // InMemory fallback with preference overwrite
      if (content.type === "preference") {
        const category = content.metadata?.category as string | undefined;
        if (category) {
          const store = memoryStore.get(walletAddress) || [];
          const filtered = store.filter(
            (m) =>
              !(m.type === "preference" && (m.metadata?.category as string) === category)
          );
          memoryStore.set(walletAddress, filtered);
        }
      }

      rememberToMemory(walletAddress, record);

      // Trim old transaction memories
      if (content.type === "transaction") {
        const store = memoryStore.get(walletAddress) || [];
        const txMemories = store
          .filter((m) => m.type === "transaction")
          .sort((a, b) => b.timestamp - a.timestamp);

        if (txMemories.length > MAX_TRANSACTION_MEMORIES) {
          const toRemoveIds = new Set(
            txMemories.slice(MAX_TRANSACTION_MEMORIES).map((m) => m.id)
          );
          memoryStore.set(
            walletAddress,
            store.filter((m) => !toRemoveIds.has(m.id))
          );
        }
      }
    }
  } catch (error) {
    console.error("[Memory] Store failed:", error);
  }
}

// --- Helpers ---

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// --- Exported for Testing ---

export function _clearMemoryStore(): void {
  memoryStore.clear();
}

export function _getMemoryStore(): Map<string, MemoryRecord[]> {
  return memoryStore;
}

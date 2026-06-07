// ============================================================
// DeFi Copilot — Memory Service
// Pluggable storage adapter pattern: InMemory (dev) + MemWal (prod)
// Graceful degradation: recall → empty array, remember → silent fail
// 5-second timeout on all external operations
// ============================================================

import { MemoryRecord, MemoryContent } from "../types";
import { config } from "../lib/config";

// --- Storage Adapter Interface ---

interface StorageAdapter {
  getMemories(walletAddress: string): Promise<MemoryRecord[]>;
  storeMemory(walletAddress: string, record: MemoryRecord): Promise<void>;
  deleteMemory(walletAddress: string, recordId: string): Promise<void>;
}

// --- InMemory Adapter (Development / Fallback) ---

const memoryStore = new Map<string, MemoryRecord[]>();

const MAX_TRANSACTION_MEMORIES = 50;

const inMemoryAdapter: StorageAdapter = {
  async getMemories(walletAddress: string): Promise<MemoryRecord[]> {
    return memoryStore.get(walletAddress) || [];
  },

  async storeMemory(walletAddress: string, record: MemoryRecord): Promise<void> {
    const existing = memoryStore.get(walletAddress) || [];
    existing.push(record);
    memoryStore.set(walletAddress, existing);
  },

  async deleteMemory(walletAddress: string, recordId: string): Promise<void> {
    const existing = memoryStore.get(walletAddress) || [];
    const filtered = existing.filter((r) => r.id !== recordId);
    memoryStore.set(walletAddress, filtered);
  },
};

// --- MemWal Adapter (Production Stub) ---
// TODO: Replace with actual MemWal SDK calls when available
// Uses fetch to call MemWal HTTP API with config.memwal.apiKey and config.memwal.delegateKey

const memwalAdapter: StorageAdapter = {
  async getMemories(walletAddress: string): Promise<MemoryRecord[]> {
    // TODO: Implement actual MemWal API call
    // Example:
    // const response = await fetch(`${MEMWAL_API_URL}/memories/${walletAddress}`, {
    //   headers: {
    //     'Authorization': `Bearer ${config.memwal.apiKey}`,
    //     'X-Delegate-Key': config.memwal.delegateKey,
    //   },
    // });
    // return response.json();

    // Fallback to in-memory until MemWal SDK is integrated
    return inMemoryAdapter.getMemories(walletAddress);
  },

  async storeMemory(walletAddress: string, record: MemoryRecord): Promise<void> {
    // TODO: Implement actual MemWal API call
    // Example:
    // await fetch(`${MEMWAL_API_URL}/memories/${walletAddress}`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${config.memwal.apiKey}`,
    //     'X-Delegate-Key': config.memwal.delegateKey,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(record),
    // });

    // Fallback to in-memory until MemWal SDK is integrated
    return inMemoryAdapter.storeMemory(walletAddress, record);
  },

  async deleteMemory(walletAddress: string, recordId: string): Promise<void> {
    // TODO: Implement actual MemWal API call
    return inMemoryAdapter.deleteMemory(walletAddress, recordId);
  },
};

// --- Adapter Selection ---

function getAdapter(): StorageAdapter {
  if (config.memwal.apiKey && config.memwal.delegateKey) {
    return memwalAdapter;
  }
  return inMemoryAdapter;
}

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

// --- Public API ---

/**
 * Recall memories for a wallet address.
 * Returns up to `limit` (default 10) recent memories sorted by timestamp desc.
 * On timeout or error, returns empty array (graceful degradation).
 */
export async function recall(
  walletAddress: string,
  context: string,
  limit: number = 10
): Promise<MemoryRecord[]> {
  try {
    const adapter = getAdapter();
    const memories = await withTimeout(
      adapter.getMemories(walletAddress),
      config.memwal.timeoutMs,
      [] as MemoryRecord[]
    );

    // Sort by timestamp descending (most recent first)
    const sorted = [...memories].sort((a, b) => b.timestamp - a.timestamp);

    // Return up to limit
    return sorted.slice(0, limit);
  } catch (error) {
    // Graceful degradation — return empty array
    console.error("[Memory] Recall failed:", error);
    return [];
  }
}

/**
 * Store a memory record for a wallet address.
 * For type "preference": overwrites existing same-category preference.
 * For type "transaction": appends, keeps last MAX_TRANSACTION_MEMORIES.
 * On timeout or error, logs and doesn't throw (silent failure).
 */
export async function remember(
  walletAddress: string,
  content: MemoryContent
): Promise<void> {
  try {
    const adapter = getAdapter();

    const record: MemoryRecord = {
      id: generateId(),
      type: content.type,
      content: content.content,
      timestamp: Date.now(),
      metadata: content.metadata,
    };

    if (content.type === "preference") {
      // Preference overwrite semantics: remove existing same-category preference
      const category = content.metadata?.category as string | undefined;
      if (category) {
        const existing = await withTimeout(
          adapter.getMemories(walletAddress),
          config.memwal.timeoutMs,
          [] as MemoryRecord[]
        );

        const duplicates = existing.filter(
          (m) =>
            m.type === "preference" &&
            (m.metadata?.category as string) === category
        );

        for (const dup of duplicates) {
          await adapter.deleteMemory(walletAddress, dup.id);
        }
      }

      await withTimeout(
        adapter.storeMemory(walletAddress, record),
        config.memwal.timeoutMs,
        undefined
      );
    } else {
      // Transaction: append, then trim to keep last MAX_TRANSACTION_MEMORIES
      await withTimeout(
        adapter.storeMemory(walletAddress, record),
        config.memwal.timeoutMs,
        undefined
      );

      // Trim old transaction memories if exceeding limit
      const allMemories = await withTimeout(
        adapter.getMemories(walletAddress),
        config.memwal.timeoutMs,
        [] as MemoryRecord[]
      );

      const txMemories = allMemories
        .filter((m) => m.type === "transaction")
        .sort((a, b) => b.timestamp - a.timestamp);

      if (txMemories.length > MAX_TRANSACTION_MEMORIES) {
        const toRemove = txMemories.slice(MAX_TRANSACTION_MEMORIES);
        for (const old of toRemove) {
          await adapter.deleteMemory(walletAddress, old.id);
        }
      }
    }
  } catch (error) {
    // Silent failure — log error, don't throw
    console.error("[Memory] Store failed:", error);
  }
}

// --- Helpers ---

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// --- Exported for Testing ---

/**
 * Clear all in-memory storage. Used for testing only.
 */
export function _clearMemoryStore(): void {
  memoryStore.clear();
}

/**
 * Get the raw memory store. Used for testing only.
 */
export function _getMemoryStore(): Map<string, MemoryRecord[]> {
  return memoryStore;
}

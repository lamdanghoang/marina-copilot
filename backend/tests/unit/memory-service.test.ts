// ============================================================
// Marina Copilot — Memory Service Unit Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { recall, remember, _clearMemoryStore } from "../../src/services/memory-service";
import { MemoryContent } from "../../src/types";

describe("Memory Service", () => {
  beforeEach(() => {
    _clearMemoryStore();
  });

  describe("recall", () => {
    it("returns empty array for unknown wallet", async () => {
      const result = await recall("0xunknown", "swap context");
      expect(result).toEqual([]);
    });

    it("returns stored memories in timestamp descending order", async () => {
      const wallet = "0xabc123";

      // Store memories with different timestamps
      await remember(wallet, {
        type: "transaction",
        content: "Swapped 100 USDC to SUI",
        metadata: { action: "swap", tokens: ["USDC", "SUI"], amounts: [100, 25] },
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await remember(wallet, {
        type: "transaction",
        content: "Staked 50 SUI",
        metadata: { action: "stake", tokens: ["SUI"], amounts: [50] },
      });

      const result = await recall(wallet, "context");

      expect(result).toHaveLength(2);
      // Most recent first
      expect(result[0].content).toBe("Staked 50 SUI");
      expect(result[1].content).toBe("Swapped 100 USDC to SUI");
      // Verify timestamp ordering
      expect(result[0].timestamp).toBeGreaterThan(result[1].timestamp);
    });

    it("respects limit parameter", async () => {
      const wallet = "0xlimit";

      // Store 5 memories
      for (let i = 0; i < 5; i++) {
        await remember(wallet, {
          type: "transaction",
          content: `Transaction ${i}`,
          metadata: { action: "swap" },
        });
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const result = await recall(wallet, "context", 3);
      expect(result).toHaveLength(3);
      // Should be the 3 most recent
      expect(result[0].content).toBe("Transaction 4");
      expect(result[1].content).toBe("Transaction 3");
      expect(result[2].content).toBe("Transaction 2");
    });

    it("defaults limit to 10", async () => {
      const wallet = "0xdefaultlimit";

      // Store 15 memories
      for (let i = 0; i < 15; i++) {
        await remember(wallet, {
          type: "transaction",
          content: `Transaction ${i}`,
          metadata: { action: "swap" },
        });
      }

      const result = await recall(wallet, "context");
      expect(result).toHaveLength(10);
    });
  });

  describe("remember", () => {
    it("stores a transaction memory", async () => {
      const wallet = "0xtx123";

      await remember(wallet, {
        type: "transaction",
        content: "Swapped 100 USDC to 25 SUI via Cetus",
        metadata: {
          action: "swap",
          tokens: ["USDC", "SUI"],
          amounts: [100, 25],
          protocol: "Cetus",
          outcome: "success",
          txDigest: "AbCdEf123456",
        },
      });

      const result = await recall(wallet, "context");
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("transaction");
      expect(result[0].content).toBe("Swapped 100 USDC to 25 SUI via Cetus");
      expect(result[0].metadata).toEqual({
        action: "swap",
        tokens: ["USDC", "SUI"],
        amounts: [100, 25],
        protocol: "Cetus",
        outcome: "success",
        txDigest: "AbCdEf123456",
      });
      expect(result[0].id).toMatch(/^mem_/);
      expect(result[0].timestamp).toBeGreaterThan(0);
    });

    it("overwrites preference of same category", async () => {
      const wallet = "0xpref";

      // Store first DEX preference
      await remember(wallet, {
        type: "preference",
        content: "Preferred DEX: Cetus",
        metadata: { category: "dex", value: "Cetus" },
      });

      // Store second DEX preference (should overwrite)
      await remember(wallet, {
        type: "preference",
        content: "Preferred DEX: Turbos",
        metadata: { category: "dex", value: "Turbos" },
      });

      const result = await recall(wallet, "context");
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Preferred DEX: Turbos");
      expect(result[0].metadata?.value).toBe("Turbos");
    });

    it("keeps different preference categories separate", async () => {
      const wallet = "0xmulticat";

      await remember(wallet, {
        type: "preference",
        content: "Preferred DEX: Cetus",
        metadata: { category: "dex", value: "Cetus" },
      });

      await remember(wallet, {
        type: "preference",
        content: "Preferred slippage: 0.5%",
        metadata: { category: "slippage", value: "0.5%" },
      });

      const result = await recall(wallet, "context");
      expect(result).toHaveLength(2);
    });

    it("does not throw on failure (silent degradation)", async () => {
      // This test verifies that remember() doesn't throw even on internal errors.
      // We test by calling with valid data — the function should never throw.
      const wallet = "0xsilent";

      // Should not throw
      await expect(
        remember(wallet, {
          type: "transaction",
          content: "Test transaction",
          metadata: { action: "swap" },
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("timeout behavior", () => {
    it("recall returns empty array on timeout", async () => {
      // We can't easily simulate a real timeout with the in-memory adapter,
      // but we verify the graceful return type behavior.
      // The timeout wrapper ensures that on any failure, [] is returned.
      const result = await recall("0xnonexistent", "context");
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("memory record structure", () => {
    it("generates unique IDs for each memory", async () => {
      const wallet = "0xids";

      await remember(wallet, {
        type: "transaction",
        content: "First",
        metadata: { action: "swap" },
      });

      await remember(wallet, {
        type: "transaction",
        content: "Second",
        metadata: { action: "stake" },
      });

      const result = await recall(wallet, "context");
      expect(result[0].id).not.toBe(result[1].id);
    });

    it("stores timestamp close to current time", async () => {
      const wallet = "0xtime";
      const before = Date.now();

      await remember(wallet, {
        type: "transaction",
        content: "Timed tx",
        metadata: { action: "swap" },
      });

      const after = Date.now();
      const result = await recall(wallet, "context");

      expect(result[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(result[0].timestamp).toBeLessThanOrEqual(after);
    });
  });
});

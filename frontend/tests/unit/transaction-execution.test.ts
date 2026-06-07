import { describe, it, expect } from "vitest";
import {
  truncateDigest,
  buildExplorerUrl,
  buildActionSummary,
} from "@/hooks/useTransactionExecution";
import type { TransactionMetadata } from "@/types";

describe("Transaction Execution Utilities", () => {
  describe("truncateDigest", () => {
    it("should truncate a normal digest to first 8 + last 4 chars", () => {
      const digest = "7f3a1b2c4d5e6f7890abcdef12345678abcdef90";
      expect(truncateDigest(digest)).toBe("7f3a1b2c...ef90");
    });

    it("should handle short digests gracefully", () => {
      expect(truncateDigest("abc")).toBe("abc");
      expect(truncateDigest("")).toBe("");
    });

    it("should handle exactly 12-char digests", () => {
      const digest = "abcdef123456";
      expect(truncateDigest(digest)).toBe("abcdef12...3456");
    });
  });

  describe("buildExplorerUrl", () => {
    it("should build a valid Sui Explorer URL for testnet", () => {
      const digest = "7f3a1b2c4d5e6f7890abcdef12345678";
      const url = buildExplorerUrl(digest);
      expect(url).toBe(
        "https://suiscan.xyz/testnet/tx/7f3a1b2c4d5e6f7890abcdef12345678"
      );
    });

    it("should include the full digest in the URL", () => {
      const digest = "fulldigesthere";
      expect(buildExplorerUrl(digest)).toContain(digest);
    });
  });

  describe("buildActionSummary", () => {
    it("should return the first step description for swap", () => {
      const metadata: TransactionMetadata = {
        type: "swap",
        steps: [
          { index: 1, description: "Swap 100 USDC → ~24.8 SUI via Cetus", type: "swap" },
          { index: 2, description: "Receive ~24.8 SUI", type: "receive" },
        ],
        gasEstimate: 0.01,
        route: ["USDC", "SUI"],
        exchangeRate: 0.248,
        estimatedOutput: 24.8,
        minimumOutput: 24.55,
        priceImpact: 0.5,
      };
      expect(buildActionSummary(metadata)).toBe(
        "Swap 100 USDC → ~24.8 SUI via Cetus"
      );
    });

    it("should return the first step description for stake", () => {
      const metadata: TransactionMetadata = {
        type: "stake",
        steps: [
          { index: 1, description: "Stake 50 SUI with Mysten Labs", type: "stake" },
        ],
        gasEstimate: 0.005,
        validatorName: "Mysten Labs",
        estimatedApy: 3.45,
      };
      expect(buildActionSummary(metadata)).toBe(
        "Stake 50 SUI with Mysten Labs"
      );
    });

    it("should return fallback for swap with empty steps", () => {
      const metadata: TransactionMetadata = {
        type: "swap",
        steps: [],
        gasEstimate: 0.01,
      };
      expect(buildActionSummary(metadata)).toBe("Swap completed");
    });

    it("should return fallback for stake with empty steps", () => {
      const metadata: TransactionMetadata = {
        type: "stake",
        steps: [],
        gasEstimate: 0.005,
        validatorName: "Mysten Labs",
      };
      expect(buildActionSummary(metadata)).toBe("Staked SUI with Mysten Labs");
    });

    it("should return generic fallback for stake without validator name", () => {
      const metadata: TransactionMetadata = {
        type: "stake",
        steps: [],
        gasEstimate: 0.005,
      };
      expect(buildActionSummary(metadata)).toBe("Staked SUI with validator");
    });
  });
});

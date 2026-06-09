// ============================================================
// Marina Copilot — Formatting Property-Based Tests
// Property 15: Wallet address truncation and balance formatting
// ============================================================

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { truncateAddress, formatBalance } from "@/lib/formatting";

// --- Generators ---

/**
 * Valid Sui address: "0x" + 64 hex chars = 66 chars total
 */
const suiAddressArb: fc.Arbitrary<string> = fc
  .hexaString({ minLength: 64, maxLength: 64 })
  .map((hex) => `0x${hex}`);

/**
 * Balance as bigint for SUI (9 decimals)
 */
const suiBalanceArb: fc.Arbitrary<bigint> = fc
  .bigInt({ min: 0n, max: 10000000000000n }) // Up to 10,000 SUI in MIST
  .filter((b) => b >= 0n);

// --- Property 15: Wallet address truncation and balance formatting ---

describe("Feature: marina-copilot-hackathon, Property 15: Wallet address truncation and balance formatting", () => {
  it("for any valid Sui address (66 chars), truncation shows first 4 hex + '...' + last 4 hex", () => {
    fc.assert(
      fc.property(suiAddressArb, (address) => {
        // Address is 66 chars: "0x" + 64 hex chars
        expect(address.length).toBe(66);

        const truncated = truncateAddress(address);

        // Should show "0x" + first 4 hex chars + "..." + last 4 hex chars
        // i.e., first 6 chars of original ("0x" + 4) + "..." + last 4 chars
        const expectedPrefix = address.slice(0, 6); // "0x" + first 4 hex
        const expectedSuffix = address.slice(-4); // last 4 hex

        expect(truncated).toContain(expectedPrefix);
        expect(truncated).toContain("...");
        expect(truncated).toContain(expectedSuffix);
        expect(truncated).toBe(`${expectedPrefix}...${expectedSuffix}`);

        // Truncated should be shorter than original
        expect(truncated.length).toBeLessThan(address.length);
      }),
      { numRuns: 100 }
    );
  });

  it("for any balance bigint, formatted to exactly 2 decimal places", () => {
    fc.assert(
      fc.property(suiBalanceArb, (balance) => {
        // Format with SUI decimals (9) and display 2 decimal places
        const formatted = formatBalance(balance, 9, 2);

        // Should be a valid number string with exactly 2 decimal places
        expect(formatted).toMatch(/^\d+\.\d{2}$/);

        // Parsing back should not produce NaN
        const parsed = parseFloat(formatted);
        expect(Number.isNaN(parsed)).toBe(false);
        expect(parsed).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  it("formatted balance always has exactly the specified number of decimal places", () => {
    fc.assert(
      fc.property(
        suiBalanceArb,
        fc.integer({ min: 1, max: 8 }),
        (balance, displayDecimals) => {
          const formatted = formatBalance(balance, 9, displayDecimals);

          // Check it has exactly `displayDecimals` digits after the dot
          const parts = formatted.split(".");
          expect(parts.length).toBe(2);
          expect(parts[1].length).toBe(displayDecimals);
        }
      ),
      { numRuns: 100 }
    );
  });
});

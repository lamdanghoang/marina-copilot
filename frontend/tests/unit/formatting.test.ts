import { describe, it, expect } from "vitest";
import { truncateAddress, formatBalance } from "@/lib/formatting";

describe("truncateAddress", () => {
  it("truncates a standard Sui address to first 4 + last 4 hex chars", () => {
    const address = "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890";
    expect(truncateAddress(address)).toBe("0x1a2b...7890");
  });

  it("handles a shorter address gracefully", () => {
    const address = "0xabcd1234";
    // 10 chars — just at the boundary
    expect(truncateAddress(address)).toBe("0xabcd...1234");
  });

  it("returns short addresses unchanged", () => {
    expect(truncateAddress("0x123")).toBe("0x123");
    expect(truncateAddress("")).toBe("");
  });

  it("handles typical 66-char Sui address", () => {
    const address = "0xaabbccdd11223344556677889900aabbccdd11223344556677889900aabbccdd";
    expect(truncateAddress(address)).toBe("0xaabb...ccdd");
  });
});

describe("formatBalance", () => {
  it("formats 1 SUI correctly (9 decimals)", () => {
    const oneSui = BigInt("1000000000"); // 1e9
    expect(formatBalance(oneSui, 9, 2)).toBe("1.00");
  });

  it("formats fractional SUI correctly", () => {
    const balance = BigInt("1500000000"); // 1.5 SUI
    expect(formatBalance(balance, 9, 2)).toBe("1.50");
  });

  it("formats large balance correctly", () => {
    const balance = BigInt("124500000000"); // 124.5 SUI
    expect(formatBalance(balance, 9, 2)).toBe("124.50");
  });

  it("formats zero balance", () => {
    expect(formatBalance(BigInt(0), 9, 2)).toBe("0.00");
  });

  it("truncates (floors) rather than rounding up", () => {
    // 1.999999999 SUI — should show 1.99, not 2.00
    const balance = BigInt("1999999999");
    expect(formatBalance(balance, 9, 2)).toBe("1.99");
  });

  it("formats USDC correctly (6 decimals)", () => {
    const balance = BigInt("100500000"); // 100.5 USDC
    expect(formatBalance(balance, 6, 2)).toBe("100.50");
  });

  it("handles small fractional amounts", () => {
    const balance = BigInt("10000000"); // 0.01 SUI
    expect(formatBalance(balance, 9, 2)).toBe("0.01");
  });
});

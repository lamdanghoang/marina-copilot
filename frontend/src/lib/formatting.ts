/**
 * Formatting utilities for wallet addresses and token balances.
 */

/**
 * Truncates a Sui wallet address to show first 4 + last 4 hex characters.
 * Example: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12" → "0x1a2b...ef12"
 */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  // Show "0x" prefix + first 4 hex chars + "..." + last 4 hex chars
  const prefix = address.slice(0, 6); // "0x" + 4 hex chars
  const suffix = address.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Formats a raw balance (in smallest units) to a human-readable string with specified decimal places.
 * SUI has 9 decimals: 1_000_000_000 raw = 1.00 SUI
 *
 * @param balance - Raw balance as bigint (in smallest units, e.g. MIST for SUI)
 * @param decimals - Number of decimal places the token uses (e.g. 9 for SUI)
 * @param displayDecimals - Number of decimal places to show in output (default 2)
 */
export function formatBalance(
  balance: bigint,
  decimals: number,
  displayDecimals: number = 2
): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = balance / divisor;
  const fractionalPart = balance % divisor;

  // Scale fractional part to desired display decimals
  const scaledFractional =
    (fractionalPart * BigInt(10 ** displayDecimals)) / divisor;

  const fractionalStr = scaledFractional
    .toString()
    .padStart(displayDecimals, "0");

  return `${wholePart.toString()}.${fractionalStr}`;
}

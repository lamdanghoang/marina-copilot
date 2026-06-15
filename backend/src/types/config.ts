// ============================================================
// Marina Copilot — Token Configuration (Sui Testnet)
// ============================================================

export interface TokenConfig {
  symbol: string;
  coinType: string;
  decimals: number;
  name: string;
  iconUrl?: string;
}

export const SUPPORTED_TOKENS: TokenConfig[] = [
  {
    symbol: "SUI",
    coinType: "0x2::sui::SUI",
    decimals: 9,
    name: "Sui",
  },
  {
    symbol: "USDC",
    coinType:
      "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    decimals: 6,
    name: "USD Coin",
  },
  {
    symbol: "USDT",
    coinType:
      "0xfb0e3eb97dd158a5ae979dddfa24348063843c5b20eb8381dd5fa7c93571571c::usdt::USDT",
    decimals: 6,
    name: "Tether USD",
  },
  {
    symbol: "WETH",
    coinType:
      "0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN",
    decimals: 8,
    name: "Wrapped Ether",
  },
  {
    symbol: "CETUS",
    coinType:
      "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
    decimals: 9,
    name: "Cetus Token",
  },
];

/**
 * Lookup a token config by symbol (case-insensitive).
 */
export function getTokenBySymbol(symbol: string): TokenConfig | undefined {
  return SUPPORTED_TOKENS.find(
    (t) => t.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

/**
 * Lookup a token config by coin type.
 */
export function getTokenByCoinType(coinType: string): TokenConfig | undefined {
  return SUPPORTED_TOKENS.find((t) => t.coinType === coinType);
}

/**
 * Check if a token symbol is supported.
 */
export function isTokenSupported(symbol: string): boolean {
  return SUPPORTED_TOKENS.some(
    (t) => t.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

/** Default slippage tolerance (1%) */
export const DEFAULT_SLIPPAGE = 0.01;

/** Minimum stake amount in SUI */
export const MINIMUM_STAKE_AMOUNT = 1;

/** Gas reserve for SUI transactions */
export const GAS_RESERVE_SUI = 0.05;

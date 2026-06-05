---
inclusion: fileMatch
fileMatchPattern: "**/*sui*,**/*ptb*,**/*stake*,**/*swap*,backend/src/services/ptb-compiler*"
---

# Sui Blockchain Patterns

## PTB (Programmable Transaction Block) Rules

- Always use `@mysten/sui` SDK for building transactions
- Use `Transaction` class (not deprecated `TransactionBlock`)
- Serialize transactions to base64 for frontend: `tx.serialize()` → send as string → frontend `Transaction.from(bytes)` → sign
- Always call `dryRunTransaction` to validate before returning to frontend
- Handle coin merging: if user has multiple coin objects of same type, merge them first

## Coin Object Handling

```typescript
// Get all coins of a type
const coins = await client.getCoins({ owner: walletAddress, coinType });

// If amount requires multiple coins, merge them
if (coins.data.length > 1) {
  const primaryCoin = coins.data[0].coinObjectId;
  const otherCoins = coins.data.slice(1).map(c => c.coinObjectId);
  tx.mergeCoins(tx.object(primaryCoin), otherCoins.map(id => tx.object(id)));
}
```

## Staking Pattern

```typescript
// Sui system address for staking
const SUI_SYSTEM_ADDRESS = '0x3';

// request_add_stake call
tx.moveCall({
  target: `${SUI_SYSTEM_ADDRESS}::sui_system::request_add_stake`,
  arguments: [
    tx.object('0x5'), // SuiSystemState shared object
    tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)]),
    tx.pure.address(validatorAddress),
  ],
});
```

## Common Token Types (Sui Testnet)

- SUI: `0x2::sui::SUI` (9 decimals)
- USDC: check testnet faucet for current package address (6 decimals)

## Gas Handling

- Default gas budget: let SDK auto-calculate via `dryRunTransaction`
- Reserve 0.05 SUI for gas when staking all SUI
- When source token is SUI for swap, reserve gas before splitting

## Error Patterns

- `InsufficientCoinBalance` → user doesn't have enough tokens
- `MoveAbort` → contract error, parse abort code for reason
- `ObjectNotFound` → stale coin object, refetch user's coins

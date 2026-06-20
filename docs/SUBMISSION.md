# Marina Copilot — Submission Description

**Marina Copilot** is a conversational AI assistant that gives users **persistent, user-owned memory on Walrus**. Unlike stateless AI assistants that forget everything between sessions, Marina remembers your preferences, transaction history, and encrypted data — all stored on decentralized Walrus storage controlled by your on-chain keys.

## Core Features (Walrus Track)

- **🔒 Time Capsules** — Encrypt messages with Seal threshold encryption, store on Walrus, unlock only after time-lock expires. On-chain metadata via custom Move contract (`seal_policy` enforces time + recipient check).
- **🧠 Persistent AI Memory (MemWal)** — Per-user on-chain accounts with Ed25519 delegate keys. AI recalls preferences and action history across sessions. User can revoke access anytime.
- **🐘 Decentralized File Storage** — Upload files to Walrus (writeBlobFlow, user signs), auto-swap SUI→WAL, extend blob epochs on-chain, download from aggregator nodes.
- **💬 Natural Language Transactions** — Swap, stake, transfer, create capsules, upload files — all through conversational AI with preview + confirm before execution.
- **🔑 Dual Auth** — Wallet extension (Slush) + zkLogin (Google via Enoki). No seed phrase needed.

## Why Walrus Is Essential

Memory, capsules, and files all live on Walrus. Remove Walrus → app has no persistence, no encrypted storage, no cross-session intelligence. Seal provides threshold encryption, MemWal provides the memory layer, and Walrus SDK handles decentralized blob storage — all user-owned and verifiable on-chain.

## Links

- **Live App:** https://marina-copilot.vercel.app
- **GitHub:** https://github.com/pnhoanglam/marina-copilot (public during judging)
- **Demo Video:** (YouTube link here)
- **Package ID:** `0x6f0a3c7df312c0d07d1dafbc38e4acbbfedaa6f651aab4efa764a91221b1cb53`
- **Network:** Sui Testnet
- **Track:** Walrus

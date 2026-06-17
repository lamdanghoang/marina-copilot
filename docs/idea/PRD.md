# Marina Copilot — Product Requirements Document

## 1. Overview

| Field | Detail |
|-------|--------|
| Product Name | Marina Copilot |
| Hackathon | Sui Overflow 2026 |
| Track | **Walrus** |
| Target Users | Users who want AI assistants with persistent, user-owned memory + secure storage |
| One-liner | A conversational AI with persistent memory, encrypted time capsules, and decentralized file storage — all powered by Walrus and owned by the user. |

## 2. Problem

DeFi on Sui is powerful but requires users to:
- Understand liquidity pools, slippage, routing
- Navigate protocol-specific UIs (Cetus, Scallop, staking)
- Manually check risks (price impact, concentration)
- Repeat the same configuration every session
- Manage seed phrases or wallet extensions

**Result**: The vast majority of potential users never engage with DeFi.

## 3. Goals

| # | Goal |
|---|------|
| G1 | AI memory persists across sessions via Walrus (MemWal) |
| G2 | User owns their memory data (per-user on-chain accounts, revocable) |
| G3 | Time Capsules: encrypted messages stored on Walrus, unlock by time |
| G4 | File Storage: decentralized file upload/download via Walrus |
| G5 | Agent becomes smarter over time (memory-driven personalization) |
| G6 | Prove Walrus value: memory + storage + encryption in one app |
| G7 | Dual auth: wallet extension + zkLogin (Google) |

## 4. Non-Goals (Out of Scope)

- Portfolio analytics / charting
- Multi-wallet management
- Fiat on-ramp / off-ramp
- Social features / copy trading
- Custom Move contract deployment
- Mobile native app (web-only for hackathon)

## 5. Target Users

### Primary: "Crypto Curious"
- Holds tokens on Sui but hasn't used DeFi
- Intimidated by swap UIs, doesn't understand slippage
- Wants to earn yield but doesn't know where to start

### Secondary: "DeFi Power User"
- Already uses DeFi but wants speed
- Values automated risk checks as a second pair of eyes
- Wants memory to skip repetitive config

## 6. User Stories

| ID | As a... | I want to... | So that... |
|----|---------|-------------|------------|
| US1 | Token holder | Type "swap 100 USDC to SUI" and get it done | I don't need to learn Cetus UI |
| US2 | Risk-averse user | See clear warnings before any risky trade | I never accidentally lose money to slippage |
| US3 | Returning user | Have the copilot remember my preferences | I don't repeat myself every session |
| US4 | Staking newcomer | Say "stake my SUI" without picking a validator | I earn yield without research |
| US5 | Privacy-conscious user | Own and control my memory data on-chain | No one else can see my financial history |
| US6 | Cautious user | Explicitly confirm before any transaction executes | Nothing happens without my approval |
| US7 | New user (no wallet) | Sign in with Google (zkLogin) | I can try DeFi without installing anything |
| US8 | Casual user | Ask "what's my balance?" | I get instant answers without transaction flow |

## 7. Functional Requirements

### 7.1 Intent Reasoning

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Parse natural-language intents into structured actions (swap, stake, query) | P0 |
| FR2 | Detect read-only queries (balance, history) and respond instantly without confirmation | P0 |
| FR3 | Ambiguous inputs trigger clarification with options | P0 |
| FR4 | Use recalled memory to personalize (DEX preference, risk appetite) | P0 |
| FR5 | Unsupported intents get helpful "can't do that yet" response | P1 |

### 7.2 PTB Compilation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR6 | Swap: find best route via Cetus Aggregator, build atomic PTB | P0 |
| FR7 | Stake: select highest-APY validator, build stake PTB | P0 |
| FR8 | DEX fallback: if preferred DEX has no route, try alternatives | P0 |
| FR9 | Balance check with gas reserve before compilation | P0 |
| FR10 | Compilation errors surface user-friendly messages | P0 |

### 7.3 Guardian Risk Assessment

| ID | Requirement | Priority |
|----|-------------|----------|
| FR11 | Check slippage (price impact >1%) with estimated loss | P0 |
| FR12 | Check concentration (>70% single asset post-trade) | P0 |
| FR13 | Cumulative concentration from last 30 days transaction history | P0 |
| FR14 | Non-swap transactions skip slippage check | P0 |
| FR15 | Plain-language explanation + actionable suggestion for each risk | P0 |

### 7.4 Transaction Preview & Confirmation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR16 | Every PTB rendered as human-readable numbered steps | P0 |
| FR17 | Show metadata: rates, min received, price impact, gas | P0 |
| FR18 | Explicit "Confirm" click required — no auto-execution | P0 |
| FR19 | Cancel returns to chat without modification | P0 |
| FR20 | Post-execution shows tx hash + explorer link | P0 |

### 7.5 Memory via Walrus (MemWal) — User Owns

| ID | Requirement | Priority |
|----|-------------|----------|
| FR21 | Per-user MemWal account created on-chain (one-time setup) | P0 |
| FR22 | User signs delegate key → app accesses memory on their behalf | P0 |
| FR23 | User can revoke delegate key (remove access) anytime | P0 |
| FR24 | Memory encrypted via Seal, stored on Walrus (decentralized) | P0 |
| FR25 | Preferences stored: overwrite semantics (latest wins) | P0 |
| FR26 | Transaction history stored (last 50, for Guardian cumulative check) | P0 |
| FR27 | Graceful degradation: app works without memory setup | P0 |

### 7.6 Authentication

| ID | Requirement | Priority |
|----|-------------|----------|
| FR28 | Wallet extension connect (Sui Wallet, Suiet via dapp-kit) | P0 |
| FR29 | zkLogin (Google OAuth → Sui address via Enoki) | P0 |
| FR30 | Display wallet address + SUI balance | P0 |
| FR31 | All transactions signed by user — app never holds private keys | P0 |

### 7.7 AI Character (Marina)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR32 | 2D animated character displayed alongside chat interface | P1 |
| FR33 | Sprite sheet animation (4×2 grid, 6fps): idle, thinking, talking, happy, sad, waving | P1 |
| FR34 | Animation state synced with app state: processing→thinking, success→happy, error→sad | P1 |
| FR35 | Character provides visual feedback — user knows system state without reading text | P1 |

## 8. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR1 | End-to-end (type → preview) latency | < 5 seconds |
| NFR2 | Works on Sui Testnet | Required |
| NFR3 | Desktop web app | Required |
| NFR4 | Graceful degradation if MemWal is down | App works, just no memory |
| NFR5 | 200+ automated tests | Required |

## 9. Constraints

- Solo developer, hackathon timeline
- Must deploy on Sui Testnet
- GitHub repo must be public during judging
- Demo video ≤ 5 minutes
- Desktop-only (no mobile responsive)

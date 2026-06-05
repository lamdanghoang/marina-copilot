# DeFi Copilot — Product Requirements Document

## 1. Overview

| Field | Detail |
|-------|--------|
| Product Name | DeFi Copilot |
| Hackathon | Sui Overflow 2026 |
| Tracks | Agentic Web (Sub-track 3: Intent Engine) + Walrus |
| Target Users | Non-technical crypto holders who want DeFi access without complexity |
| One-liner | A conversational AI that turns plain-language financial goals into safe, one-click Sui transactions — and gets smarter every session. |

## 2. Problem

DeFi on Sui is powerful but requires users to:
- Understand liquidity pools, slippage, routing
- Navigate protocol-specific UIs (Cetus, Scallop, staking)
- Manually check risks (price impact, concentration, oracle freshness)
- Repeat the same configuration every session

**Result**: The vast majority of potential users never engage with DeFi, and power users waste time on repetitive, error-prone steps.

## 3. Goals

| # | Goal | Metric |
|---|------|--------|
| G1 | Make DeFi accessible via natural language | User can execute a swap, stake, or deposit without touching any DeFi UI |
| G2 | AI reasons about user's financial goals, not just parses commands | AI recommends strategies with explanations, not just executes orders |
| G3 | AI-powered risk assessment beyond simple rules | Guardian uses market context + user behavior to assess risk holistically |
| G4 | Get smarter over time — behavioral adaptation | Detects patterns (FOMO, concentration drift), proactively suggests better strategies |
| G5 | Prove Sui's unique value | Every core feature leverages a Sui-specific primitive (PTBs, Move objects, Walrus) |

## 4. Non-Goals (Out of Scope for MVP)

- Portfolio analytics / charting
- Multi-wallet management
- Fiat on-ramp / off-ramp
- Social features / copy trading
- Custom Move contract deployment
- Mobile native app

## 5. Target Users

### Primary: "Crypto Curious"
- Holds tokens on Sui but hasn't used DeFi
- Intimidated by swap UIs, doesn't understand slippage
- Wants to earn yield but doesn't know where to start

### Secondary: "DeFi Power User"
- Already uses DeFi but wants speed
- Wants to execute actions via text instead of clicking through 5 UIs
- Values automated risk checks as a second pair of eyes

## 6. User Stories

| ID | As a... | I want to... | So that... |
|----|---------|-------------|------------|
| US1 | Token holder | Type "swap 100 USDC to SUI" and get it done | I don't need to learn Cetus UI |
| US2 | Risk-averse user | See clear warnings before any risky trade | I never accidentally lose money to slippage |
| US3 | Returning user | Have the copilot remember my preferences | I don't repeat myself every session |
| US4 | Staking newcomer | Say "stake my SUI" without picking a validator | I earn yield without research |
| US5 | Privacy-conscious user | Own and control my memory data | No one else can see my financial history |
| US6 | Cautious user | Explicitly confirm before any transaction executes | Nothing happens without my approval |

## 7. Functional Requirements

### 7.1 Intent Reasoning (AI Layer 1)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | System understands financial goals beyond literal commands (e.g. "earn yield safely" → recommends best option with reasoning) | P0 |
| FR2 | AI compares available options (protocols, rates, risks) and recommends with explanation | P0 |
| FR3 | Supported intents: swap, stake, yield deposit, transfer | P0 |
| FR4 | Ambiguous inputs trigger intelligent clarification with context-aware options | P0 |
| FR5 | AI uses recalled memory to personalize recommendations (risk appetite, history, preferences) | P0 |
| FR6 | Unsupported intents receive a helpful "can't do that yet" response | P1 |

### 7.2 PTB Compilation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR6 | Each intent compiles into a valid Sui PTB (Programmable Transaction Block) | P0 |
| FR7 | Swap uses best available route across DEXs | P0 |
| FR8 | Stake selects highest-APY validator by default | P1 |
| FR9 | Multi-step intents (swap + deposit) compile into a single atomic PTB | P1 |
| FR10 | Compilation errors surface user-friendly messages | P0 |

### 7.3 Guardian AI (AI Layer 2 — Risk Reasoning)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR11 | Guardian AI analyzes every PTB before showing preview | P0 |
| FR12 | Detects high slippage with contextual explanation (not just threshold) | P0 |
| FR13 | Detects portfolio concentration with personalized advice | P0 |
| FR14 | AI considers market context (recent volatility, price trends) in risk assessment | P0 |
| FR15 | AI considers user's behavioral patterns from memory (e.g. FOMO buying, concentration drift) | P1 |
| FR16 | Risk explanations are conversational and actionable, not generic warnings | P0 |
| FR17 | Detects stale oracle data (> 60s old) | P1 |
| FR18 | Detects low liquidity (trade > 5% of pool) | P1 |

### 7.4 Transaction Preview & Confirmation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR17 | Every PTB is rendered as human-readable steps before signing | P0 |
| FR18 | Preview shows: action description, amounts, rates, fees, gas estimate | P0 |
| FR19 | User must click "Confirm" to proceed — no auto-execution | P0 |
| FR20 | User can cancel and return to chat | P0 |
| FR21 | Post-execution shows tx hash + explorer link | P0 |

### 7.5 Memory & Behavioral Adaptation (AI Layer 3)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR22 | After each successful tx, system stores action + outcome to MemWal | P0 |
| FR23 | User-stated preferences are stored (e.g. "I prefer Cetus") | P0 |
| FR24 | Before parsing, system recalls relevant memories for context | P0 |
| FR25 | Memory persists across sessions (browser close → reopen) | P0 |
| FR26 | AI detects behavioral patterns from memory (FOMO buying, DCA, risk drift) | P0 |
| FR27 | AI proactively suggests better strategies based on detected patterns | P1 |
| FR28 | User can view what copilot remembers (memory panel) | P1 |
| FR29 | User can delete specific memories or clear all | P1 |
| FR30 | Memory is encrypted (Seal) — only user + agent can read | P1 |

### 7.6 Wallet & Connectivity

| ID | Requirement | Priority |
|----|-------------|----------|
| FR29 | User connects via Sui wallet standard (Sui Wallet, Suiet, etc.) | P0 |
| FR30 | Display wallet address + SUI balance | P0 |
| FR31 | All transactions signed by user's connected wallet | P0 |

## 8. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR1 | Intent parse latency | < 3 seconds |
| NFR2 | PTB compilation latency | < 2 seconds |
| NFR3 | Guardian check latency | < 1 second |
| NFR4 | End-to-end (type → preview) | < 6 seconds |
| NFR5 | Works on Sui Testnet | Required |
| NFR6 | Works on Sui Mainnet | Stretch |
| NFR7 | Frontend responsive (desktop + tablet) | Required |
| NFR8 | Graceful degradation if MemWal is down | App works, just no memory |

## 9. Acceptance Criteria (per Track)

### Agentic Web — Intent Engine (Sub-track 3)

| # | Criteria | Verification |
|---|---------|--------------|
| AC1 | Text → PTB → execution flow works end-to-end | Demo: type "swap 10 USDC to SUI" → tx executes on testnet |
| AC2 | Human-readable PTB preview shown before signing | Demo: preview shows step-by-step plain language |
| AC3 | Guardian catches ≥2 risk classes | Demo: large swap triggers slippage + concentration warnings |
| AC4 | Explicit confirmation step required | Demo: nothing executes until user clicks Confirm |
| AC5 | Sui primitives are essential to the design | PTBs enable atomic multi-step; Move objects enable guardian inspection |

### Walrus Track

| # | Criteria | Verification |
|---|---------|--------------|
| AC6 | Long-term memory persists across sessions | Demo: close browser, reopen → copilot recalls preferences |
| AC7 | Agent becomes more useful with memory | Demo: session 2 requires fewer questions than session 1 |
| AC8 | Memory is portable and verifiable | Stored on Walrus (decentralized), encrypted via Seal |
| AC9 | Working system, not just a demo | Full e2e with real MemWal SDK integration |

## 10. UX Flow

```
┌────────────────────────────────────────────────────┐
│                  DeFi Copilot                        │
├──────────┬─────────────────────────────────────────┤
│          │                                          │
│  Memory  │  💬 "Swap 100 USDC to SUI"              │
│  Panel   │                                          │
│          │  🤖 Compiling transaction...              │
│ ┌──────┐ │                                          │
│ │Prefs │ │  ┌──────────────────────────────────┐   │
│ │• Cetus│ │  │ 📋 Transaction Preview            │   │
│ │• 1%   │ │  │                                    │   │
│ │slipp. │ │  │ Step 1: Split 100 USDC            │   │
│ └──────┘ │  │ Step 2: Swap → ~25 SUI via Cetus  │   │
│          │  │ Rate: 1 SUI = $4.02                │   │
│ ┌──────┐ │  │ Min received: 24.75 SUI            │   │
│ │Recent│ │  │                                    │   │
│ │txs   │ │  │ ⚠️ Concentration: 72% will be SUI │   │
│ └──────┘ │  │                                    │   │
│          │  │ [✅ Confirm]     [❌ Cancel]        │   │
│          │  └──────────────────────────────────┘   │
│          │                                          │
├──────────┴─────────────────────────────────────────┤
│  [Type your financial goal here...]        [Send]   │
└────────────────────────────────────────────────────┘
```

## 11. Constraints

- Must be built during hackathon period (May 7 – Jun 21, 2026)
- Must deploy on Sui Testnet or Mainnet
- GitHub repo must be public during judging
- Demo video ≤ 5 minutes
- Solo developer — scope must be achievable in 10 days

## 12. Dependencies

| Dependency | Risk | Fallback |
|-----------|------|----------|
| Cetus Aggregator SDK | SDK may have breaking changes | Manual PTB construction with known pool addresses |
| MemWal (beta) | May be unstable | Graceful degradation — app works without memory |
| AWS Bedrock (Claude) | Rate limits / latency | Cache common parses, show loading states |
| Sui Testnet | May have outages | Test on devnet, switch back when stable |
| Scallop integration | Complex SDK | Drop to P1, focus on swap + stake |

## 13. Success Metrics

| Metric | Target |
|--------|--------|
| Supported intents working e2e | ≥ 3 (swap, stake, transfer) |
| Guardian risk classes detected | ≥ 2 |
| Memory recall accuracy | User preferences correctly applied in session 2+ |
| Demo video length | ≤ 5 min |
| Time to first tx (new user) | < 30 seconds from typing intent |

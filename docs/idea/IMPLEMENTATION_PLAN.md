# Marina Copilot — Implementation Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BACKEND                                     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ ORCHESTRATOR (API Route: /api/process-intent)                  │ │
│  │ State machine coordinating all layers                          │ │
│  └──────┬──────────────┬──────────────────┬───────────────┬──────┘ │
│         │              │                  │               │         │
│         ▼              ▼                  ▼               ▼         │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ AI Layer 1 │ │ PTB Engine │ │  AI Layer 2  │ │  AI Layer 3  │  │
│  │  Intent    │ │ (Sui-only) │ │  Guardian AI │ │  Behavioral  │  │
│  │  Reasoner  │ │            │ │              │ │  Adaptation  │  │
│  └──────┬─────┘ └──────┬─────┘ └──────┬───────┘ └──────┬───────┘  │
│         │              │               │                │          │
│         ▼              ▼               ▼                ▼          │
│    Claude/Bedrock  Sui RPC +      Claude/Bedrock    MemWal +       │
│    + Market Data   Cetus SDK      + On-chain Data   Claude/Bedrock │
└─────────────────────────────────────────────────────────────────────┘

Intelligence Distribution:
  AI (reasoning + risk + adaptation):  45%
  Sui Engineering (PTB + on-chain):    35%
  Walrus Memory (persist + recall):    15%
  Orchestration:                        5%
```

## What Makes This NOT an LLM Wrapper

| Component | LLM Wrapper Would | Marina Copilot Does |
|-----------|-------------------|-------------------|
| Intent | "Parse text → JSON" | Reason about financial goals, compare protocols, recommend with explanation |
| Execution | "Call a swap API" | Build Sui PTBs (multi-step atomic), handle coin objects, find routes |
| Risk | None or static rules | AI reasoning on market context + behavior patterns + on-chain state |
| Memory | None or local storage | Walrus-based verifiable memory that feeds back into AI reasoning |
| Remove LLM | App breaks | App could work with form UI (PTB engine is independent) |
| Remove Sui | App still works | App CANNOT exist (no PTBs, no Move objects, no Walrus) |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| UI Kit | @mysten/dapp-kit (wallet) + shadcn/ui (components) |
| State | zustand |
| LLM | Claude Sonnet via AWS Bedrock |
| PTB Builder | @mysten/sui TypeScript SDK |
| DEX Router | @cetusprotocol/aggregator-sdk |
| Market Data | Pyth Network + CoinGecko (trends) |
| Memory | MemWal TypeScript SDK (Walrus Memory) |
| Deployment | Vercel (frontend + API routes) |
| Blockchain | Sui Testnet |

---

## Task 1: Project scaffolding + Wallet connection

**Day 1 (Jun 5)**

**Objective**: Set up project, frontend skeleton, wallet connect flow.

**Implementation**:
- Init Next.js 14 app (app router) + TypeScript + Tailwind
- Install: `@mysten/dapp-kit`, `@mysten/sui`, `@tanstack/react-query`, `zustand`
- Create layout: sidebar (memory panel) + main (chat area) + bottom (input)
- Implement wallet connect/disconnect via `ConnectButton`
- Display connected address + SUI balance
- Configure Sui Testnet network

**Test**: Wallet connects, shows balance, disconnects cleanly.

---

## Task 2: Chat UI + Basic message flow

**Day 1 (Jun 5)**

**Objective**: Build conversational interface with message history.

**Implementation**:
- Chat message component (user/assistant bubbles)
- Input bar with send button + Enter key
- Message state (zustand): text, ptb_preview, risk_alert, tx_result, recommendation
- Loading/typing indicator with status text
- Auto-scroll to bottom

**Test**: Send message → user bubble → loading → placeholder response.

---

## Task 3: Intent Reasoner (AI Layer 1)

**Day 2 (Jun 6)**

**Objective**: AI that REASONS about financial goals — not just parses commands.

**Implementation**:
- API route `POST /api/reason-intent`
- AWS Bedrock client (Claude Sonnet)
- Two-phase LLM call:

**Phase A — Understanding + Reasoning:**
```
System: You are a DeFi financial advisor on Sui blockchain.
Given the user's message and their profile (from memory), you must:
1. Understand their financial GOAL (not just literal command)
2. If goal is clear and specific → output structured intent
3. If goal is vague → reason about available options, compare them, 
   and recommend with explanation

Available protocols and current data:
- Cetus DEX: swap any token pair, current SUI price $4.03
- Sui Staking: ~4.2% APY, 24h unlock
- Scallop Lending: USDC 8.5% APY, SUI 3.1% APY, instant withdraw
- Transfer: send to any Sui address

User Profile (from memory):
{recalled_memories}

Output JSON:
{
  "reasoning": "string — your analysis of what user wants and why",
  "recommendation": "string — what you recommend and why (shown to user)",
  "intent": { action, params } OR null if need clarification,
  "clarification": "string question" OR null if intent is clear
}
```

**Phase B — Smart defaults from memory:**
- If memory says "prefers Cetus" → default dex: Cetus
- If memory says "risk: moderate" → don't recommend high-risk LP

**Key difference from simple parser**: 
- Input "earn yield safely" → AI reasons: compares Scallop 8.5% (instant withdraw) vs staking 4.2% (locked) vs LP 25% (IL risk) → recommends Scallop with explanation
- Input "swap 100 USDC to SUI" → AI still outputs reasoning: "Direct swap, best route via Cetus, 0.1% impact" but proceeds without asking

**Test**:
- "swap 100 USDC to SUI" → intent + short reasoning
- "I want to earn passive income" → recommendation with options + reasoning
- "put money somewhere safe" → clarification with ranked options

---

## Task 4: PTB Compiler — Swap action

**Day 3 (Jun 7)**

**Objective**: Compile structured intent into executable Sui PTB.

**Implementation**:
- Install `@cetusprotocol/aggregator-sdk`
- Service: `PTBCompiler.compileSwap(intent, wallet) → { transaction, metadata }`
- Steps:
  1. Find user's coin objects for input token
  2. Call Cetus `findRouters({ from, target, amount, byAmountIn: true })`
  3. Build Transaction with router swap
  4. Calculate `minAmountOut`
- Return metadata: route, rate, estimatedOutput, priceImpact, pools
- Error handling: no route found, insufficient balance

**Test**: Valid Transaction → passes `dryRunTransaction` on testnet.

---

## Task 5: PTB Compiler — Stake + Yield Deposit + Transfer

**Day 4 (Jun 8)**

**Objective**: Extend PTB compiler for remaining actions.

**Implementation**:
- **Stake**: fetch validators, pick best APY, `request_add_stake`
- **Yield Deposit**: Scallop lending integration, build deposit PTB
- **Transfer**: `transferObjects` with address validation
- Each returns `{ transaction, metadata }` with step descriptions

**Test**: Each action passes dryRunTransaction on testnet.

---

## Task 6: Guardian AI (AI Layer 2)

**Day 5 (Jun 9)**

**Objective**: AI-powered risk assessment — NOT simple rule-based checks.

**Implementation**:
- Service: `GuardianAI.assess(intent, metadata, portfolio, memories)`
- Two components:

**Component A — Data Collection (deterministic):**
```typescript
const riskData = {
  priceImpact: metadata.priceImpact,          // from Cetus
  portfolioConcentration: calcConcentration(), // from on-chain balances
  oracleFreshness: checkPythStaleness(),      // from Pyth objects
  poolLiquidity: checkPoolTVL(),              // from pool objects
  recentTrend: get7dPriceChange(intent.to),   // from market data
  userBehavior: extractPatterns(memories),     // from MemWal
};
```

**Component B — AI Risk Reasoning (LLM):**
```
System: You are a DeFi risk analyst. Given the following data about a 
pending transaction, assess the risks HOLISTICALLY. Don't just check 
thresholds — consider context, user behavior, and market conditions.

Transaction: {intent summary}
Data: {riskData}
User Profile: {memories}

Output JSON:
{
  "assessment": "safe" | "warning" | "danger",
  "risks": [
    {
      "class": "HIGH_SLIPPAGE" | "CONCENTRATION" | "FOMO_PATTERN" | "STALE_DATA" | "LOW_LIQUIDITY",
      "severity": "warning" | "danger",
      "explanation": "conversational explanation of why this is risky",
      "suggestion": "actionable alternative"
    }
  ],
  "overall_note": "brief personalized note to user"
}
```

**Example**: User buying SUI for 3rd time this week as price rises:
```json
{
  "assessment": "warning",
  "risks": [
    {
      "class": "FOMO_PATTERN",
      "severity": "warning", 
      "explanation": "You've bought SUI 3 times this week, each time at a higher price. Your portfolio is now 72% SUI.",
      "suggestion": "Consider setting up a DCA ($100/day) instead of lump-sum buying into momentum."
    }
  ],
  "overall_note": "The swap itself is fine technically (0.3% slippage), but the pattern concerns me."
}
```

**Test**: 
- Large swap → slippage explanation with context
- Repeated same-direction trades → FOMO detection
- Normal small swap → "safe" with brief note

---

## Task 7: PTB Preview + Confirmation flow

**Day 6 (Jun 10)**

**Objective**: Full flow from intent reasoning to on-chain execution.

**Implementation**:
- `<ReasoningBubble>`: shows AI's recommendation/reasoning to user
- `<PTBPreview>`: renders steps as human-readable cards
- `<RiskPanel>`: Guardian AI output — conversational warnings (not static templates)
- Confirm → `signAndExecuteTransaction`
- Cancel → back to chat
- Success → tx digest + explorer link
- Failure → error + suggestion

**Flow**:
```
User types goal
  → AI reasons + recommends (shown as chat message)
  → If user agrees → PTB compiled → Guardian AI assesses
  → Preview + risks shown → User confirms → Execute
```

**Test**: Full e2e on testnet. Guardian AI response feels conversational, not robotic.

---

## Task 8: MemWal Integration — Remember + Recall

**Day 7 (Jun 11)**

**Objective**: Integrate Walrus Memory for persistent context.

**Implementation**:
- Setup MemWal account + delegate key
- Service `MemoryService`:
  - `remember(wallet, content, namespace)`
  - `recall(wallet, query, limit)`
- What gets stored:
  - After tx: `"Swapped 100 USDC → 24.8 SUI via Cetus. Price: $4.03. Slippage: 0.3%."`
  - Preferences: `"Prefers Cetus. Risk appetite: moderate. Comfortable with 1% slippage."`
  - Behavioral: `"3rd SUI purchase this week. Buys more as price rises."`
- What gets recalled:
  - Before intent reasoning: user preferences + recent actions
  - Before guardian: behavioral patterns

**Test**: Session 1 stores. Session 2 recalls correctly and influences AI behavior.

---

## Task 9: Behavioral Adaptation (AI Layer 3)

**Day 8 (Jun 12)**

**Objective**: AI detects patterns and proactively advises.

**Implementation**:
- After recalling memories, run pattern analysis:
```
System: Analyze this user's recent DeFi history. Detect any concerning 
patterns or opportunities for improvement.

Patterns to detect:
- FOMO: buying same asset repeatedly as price rises
- Concentration drift: portfolio becoming unbalanced over time
- Missed yield: holding idle assets that could earn yield
- Consistency: user always does same action → suggest automation

History: {recalled_memories}

Output: { patterns: [{type, description, suggestion}], proactive_tip: string|null }
```

- Integration:
  - If pattern detected → show proactive tip BEFORE user even asks
  - Memory indicator: "💡 Based on your history, I notice..."
  - Override: user can dismiss or say "ignore that"
- Sidebar memory panel:
  - View stored memories
  - Delete individual items
  - Clear all

**Test**: After 3+ interactions with a pattern → copilot proactively suggests improvement.

---

## Task 10: Polish + Demo video

**Day 9–10 (Jun 13–14)**

**Objective**: Production-ready polish, demo recording, submission prep.

**Implementation**:
- Error handling: network, balance, failed tx, MemWal down
- Loading states with contextual status ("Reasoning about your goal...", "Checking risks...", "Building transaction...")
- Branding: "Powered by Walrus Memory" badge
- Graceful degradation without MemWal
- Demo video (≤5min):
  1. Intro (15s)
  2. Simple swap — full flow (50s)
  3. Vague goal — AI reasons + recommends (50s)
  4. Guardian AI — catches risk with context (50s)
  5. Memory — returns next day, copilot knows preferences (50s)
  6. Behavioral — detects pattern, proactive advice (40s)
  7. Architecture — why Sui + why AI-native (45s)
- README.md + deploy to Vercel
- Public GitHub repo

**Test**: 10 consecutive interactions without crashes.

---

## Schedule

| Day | Date | Tasks | Deliverable | Status |
|-----|------|-------|-------------|--------|
| 1 | Jun 5 | Task 1 + 2 | Chat UI + wallet connected | ✅ Done |
| 2 | Jun 5 | Task 3 | AI Intent Reasoner (single LLM call) | ✅ Done |
| — | Jun 5 | Refactor | Backend tách riêng (Express + Lambda) | ✅ Done |
| 3 | Jun 6 | Task 4 | Swap PTB on testnet (Cetus) | ⬜ Next |
| 4 | Jun 7 | Task 5 + 7 | Stake PTB + Preview + Confirm + Execute | ⬜ |
| 5 | Jun 8 | Task 6 | Guardian AI (risk data + LLM reasoning) | ⬜ |
| 6 | Jun 9 | Task 7 | Full e2e flow working on testnet | ⬜ |
| 7 | Jun 10 | Task 8 | MemWal integrated (remember + recall) | ⬜ |
| 8 | Jun 11 | Task 9 | Memory-aware parsing + smart defaults | ⬜ |
| 9 | Jun 12 | Task 10a | Polish + error handling + deploy | ⬜ |
| 10 | Jun 13 | Task 10b | Demo video + README + submission prep | ⬜ |

**Buffer**: Jun 14–21 for testing, fixes, submission.

### Progress Notes
- **Day 1 (Jun 5)**: Completed ahead of schedule — finished Day 1 + Day 2 + refactor in same day
- Architecture decision: backend separated (Express local / Lambda prod) for better deploy flexibility
- MVP scope locked: Swap (primary) + Stake (secondary), 1 LLM call (merged reasoning + risk), MemWal for memory

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Cetus SDK breaking changes | Fallback: manual PTB with known pool addresses |
| MemWal beta instability | Graceful degradation: works without memory |
| Claude/Bedrock latency (3 LLM calls now) | Parallelize guardian data collection while intent reasons; cache market data |
| Testnet tokens unavailable | Request early, use small amounts |
| Guardian AI hallucination | Deterministic data collection → LLM only reasons on real data, cannot invent numbers |
| Scallop integration complexity | Drop to P1, focus swap + stake |

---

## LLM Call Budget Per Interaction

**Architecture**: Single LLM call (merged intent reasoning + risk flagging)

| Step | LLM Calls | Input Tokens (~) | Output Tokens (~) | Latency |
|------|-----------|-----------------|-------------------|---------|
| Intent Reasoner + Risk | 1 call | ~1000 (system prompt + memory + balances + message) | ~300 (reasoning + intent + risks + message) | ~2-3s |
| **Total** | **1 call** | **~1000** | **~300** | **~2-3s** |

Cost per interaction: ~$0.003 (Claude Sonnet via Bedrock)

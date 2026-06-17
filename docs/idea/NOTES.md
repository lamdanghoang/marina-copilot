# Notes & Decisions Log

## 2026-06-05: Initial Scope Decision

**MVP "Ship or Die"** — locked scope:
- 2 intents: **Swap** (primary) + **Stake** (secondary)
- Guardian: **2 risks** (slippage + concentration)
- MemWal: remember + recall
- **1 LLM call** (merged intent reasoning + risk flags)
- Desktop-only web app

## 2026-06-08: MemWal Integration

**Decision**: Per-user MemWal accounts (user owns their data)

- Each user creates MemWalAccount on-chain
- User signs delegate key → app reads/writes memory on their behalf
- User can revoke anytime via `remove_delegate_key`
- Frontend stores credentials in localStorage, sends with each API call
- Backend creates ephemeral MemWal client per-request (stateless)
- Fallback: InMemory adapter when no credentials provided

**Why not shared account?** Hackathon judges value "user owns data" for Walrus track.

## 2026-06-08: DEX Fallback (Requirement 9.4)

If user has preferred DEX (from memory) but DEX has no route for requested pair:
- Retry without DEX filter
- Inform user: "(Cetus unavailable for this pair)"
- Proceed with best available route

## 2026-06-08: zkLogin (Google OAuth)

Added as alternative auth alongside wallet extension:
- User clicks "Continue with Google"
- OAuth redirect → Enoki generates salt + address
- Ephemeral keypair for signing (stored encrypted in sessionStorage)
- ZK proof from Enoki (cached per session)

**Dependencies**: Google Cloud OAuth Client ID + Enoki API key.

## 2026-06-08: Read-Only Query Actions

Added `query` action type (balance, history):
- AI detects "what's my balance?" → returns `{ action: "query", queryType: "balance" }`
- Backend responds instantly with formatted data (no PTB, no confirm)
- Frontend displays as regular chat message

## 2026-06-08: Marina Character + Dark Theme

Ported from marina-assistant mobile app:
- 2D sprite sheet animation (4 cols × 2 rows, 688×768 per frame)
- Animations: idle, thinking, talking, happy (ok), sad (shy), waving
- State-driven: syncs with app processing/success/error states
- Dark theme: Marina color palette (cyan/teal), glassmorphism, Space Grotesk + Manrope fonts
- Glass panels, glow effects, uppercase tracking labels

## 2026-06-17: Focus Single Track — Walrus

**Decision**: Submit only to Walrus track (not Agentic Web).

**Walrus features in app:**
1. **MemWal** (AI memory) — per-user on-chain accounts, preferences persist cross-session
2. **Time Capsules** — Seal threshold encryption + Walrus blob storage + time-lock
3. **File Storage** — Walrus SDK writeBlobFlow (user signs register + certify)
4. **Chat Summary** — auto-save session summary to MemWal on disconnect

**DeFi features (swap/stake) kept** as supporting functionality — shows AI agent using memory in real workflows. Not the submission focus.

---

## Submission Checklist

| Field | Status |
|-------|--------|
| Project Name | ✅ "Marina Copilot" |
| Public GitHub Repo | ⬜ |
| Demo Video (≤ 5 min) | ⬜ |
| Website (Vercel) | ⬜ |
| Deployed on Sui Testnet | ⬜ |
| README complete | ✅ |

### Pre-Submit Checks
- [ ] GitHub repo set to **public**
- [ ] Demo video uploaded to YouTube
- [ ] App deployed (Vercel + Lambda)
- [ ] App works on Sui Testnet
- [ ] No hardcoded secrets in repo
- [ ] .env.example files present

# DeFi Copilot — Project Conventions

## Project Overview

DeFi Copilot is a conversational AI assistant on Sui blockchain for the Sui Overflow 2026 hackathon (Agentic Web + Walrus tracks). It converts natural-language financial intents into safe, one-click transactions via Sui PTBs with persistent memory.

## Tech Stack

### Frontend (separate repo/deploy)
- **Framework**: Next.js 14 (App Router) + TypeScript strict + Tailwind CSS
- **UI Kit**: @mysten/dapp-kit (wallet) + shadcn/ui (components)
- **State**: zustand
- **Deployment**: Vercel
- **Communicates with**: Backend via REST API (CORS enabled)

### Backend (separate repo/deploy)
- **Framework**: Express.js + TypeScript
- **LLM**: Claude Sonnet via AWS Bedrock (single merged call per interaction)
- **PTB Builder**: @mysten/sui TypeScript SDK
- **DEX Router**: @cetusprotocol/aggregator-sdk
- **Memory**: MemWal TypeScript SDK (Walrus Memory)
- **Deployment**: AWS Lambda (via serverless-http or SAM)
- **Blockchain**: Sui Testnet

### Shared
- **Testing**: vitest + fast-check (property-based testing)
- **Types**: Shared TypeScript interfaces (published as internal package or duplicated)

## Monorepo Structure

```
copilot/
├── frontend/                 # Next.js frontend app — deploys to Vercel
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   └── page.tsx      # Main chat page
│   │   ├── components/       # React components (ChatMessage, ChatInput, PTBPreview, WalletButton, TypingIndicator)
│   │   ├── store/            # Zustand store (copilot-store.ts)
│   │   ├── types/            # TypeScript interfaces (shared types copied here)
│   │   ├── lib/              # Utilities, API client, config
│   │   └── hooks/            # Custom React hooks
│   ├── tests/
│   │   └── unit/             # Frontend unit tests
│   ├── package.json
│   ├── tailwind.config.ts
│   └── next.config.js
│
├── backend/                  # Express backend — deploys to AWS Lambda
│   ├── src/
│   │   ├── routes/           # Express route handlers (process-intent, remember, health)
│   │   ├── services/         # Business logic (intent-parser, ptb-compiler, guardian, memory-service, llm-client)
│   │   ├── types/            # TypeScript interfaces (shared types copied here)
│   │   ├── lib/              # Utilities, config, constants
│   │   └── index.ts          # Express app entry point
│   ├── tests/
│   │   ├── properties/       # Property-based tests (fast-check)
│   │   ├── unit/             # Unit tests
│   │   ├── integration/      # Integration tests (external services)
│   │   └── edge-cases/       # Timeout and degradation tests
│   ├── package.json
│   ├── serverless.yml        # Or SAM template for Lambda deployment
│   └── tsconfig.json
│
├── docs/                     # Project documentation (hackathon rules, ideas, etc.)
└── .kiro/                    # Kiro specs and steering
```

## Coding Conventions

### TypeScript
- Strict mode enabled, no `any` types
- Use interfaces (not type aliases) for object shapes
- Export all types from `src/types/index.ts`
- Use discriminated unions for response types (e.g. `type: "clarification" | "preview" | "error"`)
- Use enums for error codes (`ErrorCode`)

### Naming
- Files: kebab-case (`intent-parser.ts`, `ptb-compiler.ts`)
- Components: PascalCase (`ChatMessage.tsx`, `PTBPreview.tsx`)
- Interfaces: PascalCase (`SwapIntent`, `GuardianOutput`)
- Functions/methods: camelCase (`compileSwap`, `assessRisks`)
- Constants: UPPER_SNAKE_CASE (`SUPPORTED_TOKENS`, `DEFAULT_SLIPPAGE`)

### Components
- Functional components only (no class components)
- Use shadcn/ui for base components (Button, Card, Input, Badge)
- Tailwind for styling — no CSS modules or styled-components
- Keep components small and focused (< 150 lines)

### Services
- Each service is a module with exported functions (not classes)
- Services return typed results, never throw — use `AppError` return type for errors
- All external calls have explicit timeouts (MemWal: 5s, LLM: 8s, Cetus: 10s, Tx: 60s)

### Error Handling
- Memory failures: silent degradation, log to console, proceed without memory
- LLM failures: return user-friendly retry message
- Compilation failures: return specific error with suggestion
- Wallet failures: dismiss loading, show cancellation
- Never expose raw error messages to users

## Architecture Principles

### Frontend ↔ Backend Communication
- Frontend calls backend via REST API (`POST /api/process-intent`, `POST /api/remember`, `GET /api/health`)
- Backend base URL configured via `NEXT_PUBLIC_API_URL` env var in frontend
- Backend enables CORS for the frontend origin
- Frontend handles all wallet interactions (signing, broadcasting) — backend never touches private keys
- Backend returns serialized transaction bytes; frontend deserializes, signs, and broadcasts

### Pipeline Flow
Every user message follows: `recall → parse → compile → assess → preview → confirm → execute → remember`
- Steps `recall → parse → compile → assess` happen on **backend**
- Steps `preview → confirm → execute` happen on **frontend**
- Step `remember` is triggered by frontend calling backend after successful execution

### Single LLM Call
- One Claude Sonnet call per interaction (merges intent reasoning + risk flagging)
- Target: < 5 seconds end-to-end latency
- Context includes: user message + up to 10 memories + wallet balances

### Graceful Degradation
- App must work without MemWal (first-time user experience)
- MemWal unavailable = proceed with empty memory, no error shown
- Store failure = log silently, still show transaction success

### Guardian Risk Rules
- Slippage: flag when price impact > 1%
- Concentration: flag when single asset > 70% of portfolio
- Non-swap transactions: skip slippage check
- Always include: explanation (plain language) + suggestion (actionable)

## Testing Requirements

### Property-Based Tests (fast-check)
- Minimum 100 iterations per property
- Tag: `Feature: defi-copilot-hackathon, Property {N}: {title}`
- Cover: Guardian logic, balance validation, formatting, memory semantics, intent parsing

### Running Tests
```bash
# Frontend
cd frontend && npm run test

# Backend
cd backend && npm run test          # Run all tests
cd backend && npm run test:props    # Property-based tests only
cd backend && npm run test:unit     # Unit tests only
```

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001   # Backend URL (Lambda URL in prod)
NEXT_PUBLIC_SUI_NETWORK=testnet
```

### Backend (.env)
```
PORT=3001
CORS_ORIGIN=http://localhost:3000           # Frontend URL (Vercel URL in prod)
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
BEDROCK_MODEL_ID=anthropic.claude-sonnet-...
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
MEMWAL_API_KEY=
MEMWAL_DELEGATE_KEY=
CETUS_API_URL=
```

## Key Constraints

- Solo developer, 10-day build timeline
- Desktop-only (no mobile responsive)
- Sui Testnet deployment required
- MVP = swap e2e working (Day 4)
- Demo video ≤ 5 minutes
- GitHub repo must be public during judging

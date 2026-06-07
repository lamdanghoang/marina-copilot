# Implementation Plan: DeFi Copilot

## Overview

DeFi Copilot is a conversational AI assistant for the Sui blockchain that converts natural-language intents into safe, one-click transactions. The implementation follows a pipeline architecture (parse → compile → assess → preview → confirm → execute → remember) with a single merged LLM call for minimal latency.

The plan is structured around the 10-day hackathon timeline with each day ending in a demoable state. Day 4 = MVP submittable (swap e2e working). Architecture: Frontend (Next.js on Vercel) and Backend (Express on AWS Lambda) deployed independently, communicating via REST API.

## Tasks

- [x] 1. Project scaffolding with separate FE/BE (Day 1)
  - [x] 1.1 Initialize monorepo with frontend and backend projects
    - Create `frontend/` directory: Next.js 14 app with App Router, TypeScript strict, Tailwind CSS
    - Install frontend deps: `@mysten/dapp-kit`, `@mysten/sui`, `@tanstack/react-query`, `zustand`, `tailwindcss`, `shadcn/ui`
    - Create `backend/` directory: Express app with TypeScript
    - Install backend deps: `express`, `cors`, `@mysten/sui`, `@cetusprotocol/aggregator-sdk`, `@aws-sdk/client-bedrock-runtime`, `serverless-http`
    - Set up frontend directory structure: `src/components/`, `src/store/`, `src/types/`, `src/lib/`, `src/hooks/`
    - Set up backend directory structure: `src/routes/`, `src/services/`, `src/types/`, `src/lib/`
    - Configure CORS on backend to allow frontend origin
    - Configure `NEXT_PUBLIC_API_URL` in frontend to point to backend
    - Configure Sui Testnet provider in frontend with `@mysten/dapp-kit`
    - _Requirements: 7.1_

  - [x] 1.2 Define shared TypeScript interfaces and types
    - Create `backend/src/types/index.ts` with all interfaces from design: `ProcessIntentRequest`, `ProcessIntentResponse`, `StructuredIntent`, `SwapIntent`, `StakeIntent`, `ChatMessage`, `TokenBalance`, `RiskWarning`, `PTBStep`, `TransactionMetadata`, `PortfolioBalance`, `MemoryRecord`, `AppError`, `ErrorCode`
    - Create `frontend/src/types/index.ts` mirroring the same response/request interfaces
    - Create `backend/src/types/config.ts` with `TokenConfig` and `SUPPORTED_TOKENS` registry for Sui Testnet
    - _Requirements: 1.1, 1.2, 2.2, 3.3, 4.3, 4.4_

  - [x] 1.3 Implement wallet connection and balance display (Frontend)
    - Create `frontend/src/components/WalletButton.tsx` using `@mysten/dapp-kit` `ConnectButton`
    - Implement address truncation (first 4 + last 4 hex chars) and SUI balance formatting (2 decimal places)
    - Display connected wallet info in header
    - Disable chat input when wallet disconnected with connect prompt
    - Handle wallet connection errors and disconnection events
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 1.4 Create API client for frontend-to-backend communication
    - Create `frontend/src/lib/api-client.ts` with methods: `processIntent()`, `remember()`, `healthCheck()`
    - Base URL from `NEXT_PUBLIC_API_URL` environment variable
    - Handle network errors, timeouts, and non-200 responses gracefully
    - _Requirements: 12.1_

  - [ ]* 1.5 Write property tests for wallet address formatting
    - **Property 15: Wallet address truncation and balance formatting**
    - **Validates: Requirements 7.2**

- [ ] 2. Chat interface and conversational UX — Frontend (Day 1-2)
  - [x] 2.1 Create Zustand store for application state
    - Implement `CopilotStore` interface from design with all state slices and actions
    - Include wallet state, chat messages, processing state, current preview
    - Implement `sendMessage` (calls API client), `confirmTransaction`, `cancelPreview`, `connectWallet`, `disconnectWallet` actions
    - _Requirements: 10.1, 10.4, 10.6_

  - [x] 2.2 Build chat UI components
    - Create `frontend/src/components/ChatMessage.tsx` with right-aligned user messages and left-aligned assistant messages with distinct backgrounds
    - Create `frontend/src/components/ChatInput.tsx` with input bar, Send button, Enter key submission
    - Create `frontend/src/components/TypingIndicator.tsx` with animated indicator and contextual status text
    - Implement auto-scroll behavior when new content appears
    - Disable input and Send button during processing
    - Validate non-empty message after trimming before submission
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 2.3 Write property test for message input validation
    - **Property 19: Message input validation**
    - **Validates: Requirements 10.3**

- [x] 3. Intent Parser with single merged LLM call — Backend (Day 2)
  - [x] 3.1 Implement LLM client for AWS Bedrock (Claude Sonnet)
    - Create `backend/src/services/llm-client.ts` with Bedrock API integration
    - Implement 8-second timeout with error handling
    - Create system prompt template that merges intent reasoning + risk flagging
    - Handle LLM errors with user-friendly messages
    - _Requirements: 12.1, 12.4_

  - [x] 3.2 Implement Intent Parser service
    - Create `backend/src/services/intent-parser.ts` implementing `IntentParserInput` → `IntentParserOutput`
    - Assemble LLM context: user message + up to 10 memories + wallet balances + conversation history
    - Parse LLM response into structured intent OR clarification
    - Extract risk flags (slippage concern, concentration concern) from response
    - Handle missing fields with clarification questions naming each missing field
    - Handle unknown tokens with error naming the unrecognized symbol
    - Apply memory preferences as defaults without asking clarification
    - Include memory indicator when preferences are applied
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 9.1, 12.1, 12.2, 12.3_

  - [ ]* 3.3 Write property tests for intent parsing logic
    - **Property 1: Incomplete intent produces clarification naming all missing fields**
    - **Validates: Requirements 1.3**

  - [ ]* 3.4 Write property tests for unknown token handling
    - **Property 2: Unknown token produces error naming the unrecognized symbol**
    - **Validates: Requirements 1.6**

  - [ ]* 3.5 Write property tests for memory preference defaults
    - **Property 3: Memory preferences become intent defaults without clarification**
    - **Validates: Requirements 1.5, 9.1**

  - [ ]* 3.6 Write property tests for LLM context assembly
    - **Property 20: LLM context assembly completeness**
    - **Validates: Requirements 12.2**

  - [ ]* 3.7 Write property tests for LLM response parsing
    - **Property 21: LLM response parsing produces valid structured output**
    - **Validates: Requirements 12.3**

- [x] 4. Checkpoint - Core parsing works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. PTB Compiler — Swap action, Backend (Day 3)
  - [x] 5.1 Implement swap PTB compilation with Cetus Aggregator
    - Create `backend/src/services/ptb-compiler.ts` with `compileSwap(intent, walletAddress)` method
    - Install and configure `@cetusprotocol/aggregator-sdk` for Sui Testnet
    - Query Cetus for best-output route for the requested token pair
    - Build Sui `Transaction` object with router swap
    - Calculate `minimumOutput` using default 1% slippage tolerance when user hasn't specified
    - Serialize transaction to base64 bytes for frontend signing
    - Return full `TransactionMetadata`: route path, exchange rate, estimated output, minimum output, price impact, gas estimate
    - Handle errors: no route found, insufficient balance (include available vs required amounts), Cetus timeout (10s)
    - Reserve gas when source token is SUI
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 5.2 Write property tests for swap metadata completeness
    - **Property 4: Compiled transaction metadata contains all required fields for its action type**
    - **Validates: Requirements 2.2, 3.3**

  - [ ]* 5.3 Write property tests for insufficient balance error
    - **Property 5: Insufficient balance error includes available balance and required amount**
    - **Validates: Requirements 2.4, 3.4**

  - [ ]* 5.4 Write property tests for default slippage calculation
    - **Property 6: Default slippage tolerance calculation**
    - **Validates: Requirements 2.5**

- [ ] 6. PTB Compiler — Stake action, Backend (Day 3-4)
  - [x] 6.1 Implement stake PTB compilation
    - Add `compileStake(intent, walletAddress)` method to PTB Compiler in `backend/src/services/ptb-compiler.ts`
    - Fetch active validators from Sui system state
    - Select highest APY validator when user has no preference
    - Build `Transaction` with `request_add_stake` Move call
    - Serialize transaction to base64 bytes for frontend signing
    - Return metadata: validator name, estimated APY (2 decimal places), gas estimate
    - Handle errors: insufficient balance (minus 0.05 SUI gas reserve), below minimum 1 SUI, validator data unavailable
    - Validate via `dryRunTransaction` on Sui Testnet
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 6.2 Write property test for highest APY validator selection
    - **Property 7: Highest APY validator selection**
    - **Validates: Requirements 3.2**

- [x] 7. Guardian risk assessment — Backend (Day 4)
  - [x] 7.1 Implement Guardian service with deterministic risk checks
    - Create `backend/src/services/guardian.ts` implementing `GuardianInput` → `GuardianOutput`
    - Implement slippage detection: flag when price impact > 1%, include impact percentage and estimated dollar loss
    - Implement concentration detection: flag when single-asset > 70% of portfolio value after transaction
    - Return "safe" assessment with empty risks array when no risks detected
    - Skip slippage check for non-swap transactions (stake only gets concentration check)
    - Every risk warning must have non-empty explanation and suggestion strings
    - Handle missing portfolio data gracefully (skip concentration check, proceed with slippage)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 7.2 Write property tests for Guardian slippage detection
    - **Property 8: Guardian slippage detection with data**
    - **Validates: Requirements 4.1, 4.3**

  - [ ]* 7.3 Write property tests for Guardian concentration detection
    - **Property 9: Guardian concentration detection with data**
    - **Validates: Requirements 4.2, 4.4**

  - [ ]* 7.4 Write property tests for risk warning completeness
    - **Property 10: All risk warnings contain explanation and suggestion**
    - **Validates: Requirements 4.5**

  - [ ]* 7.5 Write property tests for safe assessment
    - **Property 11: No risks detected implies safe assessment**
    - **Validates: Requirements 4.6**

  - [ ]* 7.6 Write property tests for non-swap transaction handling
    - **Property 12: Non-swap transactions skip slippage check**
    - **Validates: Requirements 4.7**

- [ ] 8. Orchestrator API and pipeline wiring — Backend (Day 4)
  - [ ] 8.1 Implement orchestrator Express routes
    - Create `backend/src/routes/process-intent.ts` implementing `POST /api/process-intent`
    - Wire pipeline: recall memories → parse intent → compile PTB → serialize transaction → assess risks → return preview + transactionBytes
    - Handle clarification flow (return early when intent needs clarification)
    - Handle error flow (return structured errors with suggestions)
    - Implement timeout configurations per operation (MemWal 5s, LLM 8s, Cetus 10s)
    - Create `backend/src/routes/remember.ts` for `POST /api/remember`
    - Create `backend/src/routes/health.ts` for `GET /api/health`
    - Create `backend/src/index.ts` Express app entry point with CORS middleware
    - _Requirements: 12.1, 11.1, 11.4_

- [ ] 9. Checkpoint - Swap e2e working (Day 4 MVP)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. PTB Preview and confirmation flow — Frontend (Day 5)
  - [ ] 10.1 Build Preview Renderer components
    - Create `frontend/src/components/PTBPreview.tsx` with numbered step list (action verb + token names + amounts)
    - Display swap metadata: exchange rate, minimum received, price impact, gas fee
    - Display stake metadata: validator name, estimated APY, gas fee
    - Show risk warnings with severity indicators (warning/elevated/danger), explanation, suggestion
    - Change confirm button to "Confirm Anyway" with distinct style when risks present
    - Show "No risks detected" positive indicator when assessment is "safe"
    - Implement Confirm and Cancel buttons
    - Disable Confirm button immediately after click to prevent double-submission
    - Cancel dismisses preview and returns to chat input
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 10.2 Write property tests for preview rendering completeness
    - **Property 13: Preview renders complete data for its response type**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.6**

- [ ] 11. Transaction execution and feedback — Frontend (Day 5)
  - [ ] 11.1 Implement transaction execution flow
    - Deserialize `transactionBytes` (base64) from backend response into `Transaction` object
    - Submit to connected wallet via `signAndExecuteTransaction` from `@mysten/dapp-kit`
    - Display loading states with phase-specific status messages (signing, submitting, confirming)
    - Show success message: action summary, amounts, truncated digest (first 8 + last 4 chars), Sui Explorer link
    - Handle on-chain failure with plain-language reason and suggestion
    - Handle wallet rejection: dismiss loading, show cancellation message, return to input
    - Handle 60-second transaction timeout with explorer advice
    - Trigger memory store (call backend `/api/remember`) on successful transaction
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 11.2 Write property tests for success message formatting
    - **Property 14: Success message contains all required fields**
    - **Validates: Requirements 6.3**

- [ ] 12. Checkpoint - Full flow with preview and execution
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. MemWal integration — remember and recall, Backend (Day 6)
  - [ ] 13.1 Implement Memory Service with MemWal SDK
    - Create `backend/src/services/memory-service.ts` implementing `MemoryService` interface
    - Implement `recall(walletAddress, context, limit)`: fetch up to 10 recent memories from MemWal
    - Implement `remember(walletAddress, content)`: store memory record to MemWal
    - Store transaction memories: action type, tokens, amounts, protocol, outcome, txDigest, timestamp
    - Store preference memories with category-based overwrite semantics
    - Implement 5-second timeout on all MemWal operations
    - Graceful degradation: proceed with empty memory on recall failure, silent failure on store failure
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 11.1, 11.2, 11.3, 11.4_

  - [ ]* 13.2 Write property tests for memory record completeness
    - **Property 16: Memory record completeness on store**
    - **Validates: Requirements 8.1**

  - [ ]* 13.3 Write property tests for preference overwrite semantics
    - **Property 17: Preference overwrite semantics**
    - **Validates: Requirements 8.2**

  - [ ]* 13.4 Write property tests for memory indicator content
    - **Property 18: Memory indicator names applied preference**
    - **Validates: Requirements 8.5**

- [ ] 14. Memory-aware intent parsing and smart defaults (Day 7)
  - [ ] 14.1 Wire memory into orchestrator pipeline
    - Call `MemoryService.recall()` before intent parsing in orchestrator
    - Pass recalled memories to Intent Parser for preference-based defaults
    - Display memory indicator in chat when preferences are applied (e.g. "Using Cetus (your preferred DEX)")
    - Handle first-time vs returning user flow (clarify DEX on first use, skip on return)
    - Handle fallback when preferred DEX has no route for requested pair
    - _Requirements: 8.3, 8.5, 9.1, 9.3, 9.4_

  - [ ] 14.2 Implement cumulative concentration with transaction history
    - Extend Guardian to consider recalled transaction history (last 30 days)
    - Calculate combined single-asset exposure factoring in prior transactions + pending transaction
    - Flag concentration warning when cumulative exposure exceeds 70%
    - _Requirements: 9.2_

  - [ ]* 14.3 Write property test for cumulative concentration
    - **Property 22: Cumulative concentration considers transaction history**
    - **Validates: Requirements 9.2**

- [ ] 15. Checkpoint - Memory system integrated
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Error handling, edge cases, and graceful degradation (Day 8)
  - [ ] 16.1 Implement comprehensive error handling across all services
    - LLM timeout (8s): return friendly retry message, re-enable input
    - Cetus timeout (10s): return routing unavailable error with pair info
    - MemWal unavailable (5s): proceed without memory, no error shown to user
    - Memory store failure: log silently, still show transaction success
    - Wallet rejection: dismiss loading, show cancel message
    - Transaction on-chain failure: plain-language reason + suggestion
    - Transaction timeout (60s): timeout message + Sui Explorer link
    - Unknown token: error message naming the unrecognized symbol
    - Insufficient balance: show available vs required amounts
    - Stake below minimum (1 SUI): error with minimum amount
    - Validator data unavailable: block stake with error message
    - _Requirements: 2.3, 2.4, 2.6, 3.4, 3.5, 3.6, 6.4, 6.6, 6.7, 11.1, 11.2, 11.3, 11.4, 12.4_

- [ ] 17. Deployment configuration (Day 8-9)
  - [ ] 17.1 Configure separate FE/BE deployments
    - Set up Vercel project for `frontend/` directory (Next.js)
    - Configure `NEXT_PUBLIC_API_URL` env var in Vercel pointing to Lambda URL
    - Create `backend/serverless.yml` (or SAM template) for AWS Lambda deployment
    - Configure API Gateway with CORS allowing Vercel frontend origin
    - Set up backend environment variables in Lambda: Bedrock credentials, Sui RPC, MemWal config
    - Create `frontend/.env.example` and `backend/.env.example` with all required variables
    - Verify both deployments work independently and can communicate
    - Test end-to-end flow: frontend (Vercel) → backend (Lambda) → Sui Testnet
    - _Requirements: 12.1_

- [ ] 18. Polish and submission preparation (Day 9-10)
  - [ ] 18.1 UI polish and loading states
    - Add contextual loading status text ("Parsing intent...", "Compiling transaction...", "Checking risks...")
    - Ensure all loading states transition smoothly
    - Add "Powered by Walrus Memory" indicator
    - Verify 10 consecutive interactions without crashes
    - Ensure end-to-end latency stays below 5 seconds
    - _Requirements: 10.2, 12.1_

  - [ ] 18.2 Create README and submission assets
    - Write README.md with: setup instructions, architecture diagram, tech stack, demo link
    - Ensure no hardcoded secrets in repo
    - Set GitHub repo to public
    - Verify app works on Sui Testnet (swap executes, memory persists)
    - _Requirements: all_

- [ ] 19. Final checkpoint - Production ready
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at Day 2, Day 4 (MVP), Day 5, Day 7, and final
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- Day 4 target: swap end-to-end working = MVP submittable
- MemWal integration can gracefully degrade — the app works without memory
- Single merged LLM call keeps latency under 5 seconds

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "1.4"] },
    { "id": 3, "tasks": ["2.3", "3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["3.3", "3.4", "3.5", "3.6", "3.7", "5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3", "5.4", "6.1"] },
    { "id": 7, "tasks": ["6.2", "7.1"] },
    { "id": 8, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6", "8.1"] },
    { "id": 9, "tasks": ["10.1", "11.1"] },
    { "id": 10, "tasks": ["10.2", "11.2", "13.1"] },
    { "id": 11, "tasks": ["13.2", "13.3", "13.4", "14.1"] },
    { "id": 12, "tasks": ["14.2", "14.3"] },
    { "id": 13, "tasks": ["16.1", "17.1"] },
    { "id": 14, "tasks": ["18.1", "18.2"] }
  ]
}
```

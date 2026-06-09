# Requirements Document

## Introduction

Marina Copilot is a conversational AI assistant for the Sui blockchain that turns plain-language financial goals into safe, one-click transactions. It targets two tracks in the Sui Overflow 2026 hackathon: Agentic Web (Sub-track 3: Intent Engine) and the Walrus Track.

The system parses natural-language intents, compiles them into Sui Programmable Transaction Blocks (PTBs), runs a guardian risk check surfacing warnings in plain language, requires explicit user confirmation before execution, and persists memory across sessions via Walrus (MemWal) so the agent becomes more useful over time.

MVP scope (solo developer, 10 days): Swap (primary intent), Stake (secondary intent), 2 risk classes (slippage + concentration), MemWal remember/recall, single merged LLM call, desktop-only web app on Sui Testnet.

## Glossary

- **Copilot**: The Marina Copilot application — the conversational AI system under development
- **Intent_Parser**: The AI subsystem that interprets user natural-language messages into structured intent objects
- **PTB_Compiler**: The subsystem that transforms structured intents into executable Sui Programmable Transaction Blocks
- **Guardian**: The risk assessment subsystem that analyzes compiled PTBs for slippage and concentration risks before preview
- **Memory_Service**: The subsystem responsible for storing and recalling user interaction data via MemWal (Walrus Memory)
- **Preview_Renderer**: The frontend subsystem that displays human-readable PTB steps, risk warnings, and confirmation controls
- **PTB**: Programmable Transaction Block — Sui's native atomic multi-step transaction primitive
- **MemWal**: Walrus Memory SDK — persistent, portable, verifiable memory storage on Walrus
- **Slippage**: The difference between expected and actual swap output due to price impact
- **Concentration_Risk**: The risk that a user's portfolio becomes over-weighted in a single asset
- **Cetus_Aggregator**: The DEX aggregator SDK used to find optimal swap routes on Sui
- **User**: A person interacting with the Copilot through the chat interface with a connected Sui wallet

## Requirements

### Requirement 1: Parse Natural-Language Intents

**User Story:** As a token holder, I want to type my financial goal in plain English, so that I can execute DeFi transactions without learning protocol-specific UIs.

#### Acceptance Criteria

1. WHEN a User submits a message containing a swap intent (e.g. "swap 100 USDC to SUI"), THE Intent_Parser SHALL extract the action type, source token, target token, and amount into a structured intent object within 3 seconds of submission
2. WHEN a User submits a message containing a stake intent (e.g. "stake 50 SUI"), THE Intent_Parser SHALL extract the action type, token, and amount into a structured intent object within 3 seconds of submission
3. WHEN a User submits a message that the Intent_Parser can parse into a supported action type but one or more required fields are missing (amount, source token, or target token for swaps; amount or token for stakes), THE Intent_Parser SHALL respond with a clarification question that names each missing field
4. WHEN a User submits a message unrelated to supported DeFi actions (swap, stake, transfer), THE Intent_Parser SHALL respond with a message listing the supported action types the User can request
5. WHEN the Memory_Service returns user preferences matching the current action type (e.g. preferred DEX for a swap intent, preferred validator for a stake intent), THE Intent_Parser SHALL incorporate those preferences as defaults in the structured intent without asking the User again
6. IF the Intent_Parser cannot match a token symbol in the User's message to a known token on Sui, THEN THE Intent_Parser SHALL respond with an error message indicating which token symbol was not recognized and ask the User to verify the token name

### Requirement 2: Compile Swap PTB

**User Story:** As a token holder, I want my swap intent compiled into an executable Sui transaction, so that I can trade tokens in one click.

#### Acceptance Criteria

1. WHEN the Intent_Parser produces a valid swap intent, THE PTB_Compiler SHALL query the Cetus_Aggregator for the best-output route and build a Sui PTB that passes transaction validation
2. THE PTB_Compiler SHALL include metadata with each compiled swap: route path, exchange rate, estimated output amount, minimum output amount, price impact percentage, and gas estimate
3. IF the Cetus_Aggregator returns no available route for the requested token pair, THEN THE PTB_Compiler SHALL return an error message indicating that no route is available for the specified pair
4. IF the User's wallet balance for the source token minus the required gas reserve (when source token is SUI) is less than the requested swap amount, THEN THE PTB_Compiler SHALL return an error message specifying the available balance, the required gas reserve, and the required swap amount
5. WHEN a swap PTB is compiled and the User has not specified a slippage tolerance, THE PTB_Compiler SHALL set the minimum output amount based on a default 1% slippage tolerance applied to the estimated output amount
6. IF the Cetus_Aggregator fails to respond within 10 seconds, THEN THE PTB_Compiler SHALL return an error message indicating that the routing service is unavailable and the User should retry

### Requirement 3: Compile Stake PTB

**User Story:** As a staking newcomer, I want to stake my SUI without manually selecting a validator, so that I can earn yield without research.

#### Acceptance Criteria

1. WHEN the Intent_Parser produces a valid stake intent, THE PTB_Compiler SHALL build a valid Sui PTB that delegates the specified SUI amount to a validator, where valid means the PTB is accepted by Sui's dry-run simulation without errors
2. IF the User does not specify a validator preference, THEN THE PTB_Compiler SHALL select the active validator with the highest APY reported by the Sui network's current epoch data
3. THE PTB_Compiler SHALL include metadata with each compiled stake: validator name, estimated APY as a percentage to two decimal places, and gas estimate in SUI
4. IF the User's available SUI balance minus a gas reserve of 0.05 SUI is less than the requested stake amount, THEN THE PTB_Compiler SHALL return an error message specifying the available stakeable balance
5. IF the requested stake amount is less than 1 SUI, THEN THE PTB_Compiler SHALL return an error message indicating the minimum stake amount is 1 SUI
6. IF the PTB_Compiler cannot retrieve validator data from the Sui network, THEN THE PTB_Compiler SHALL return an error message indicating that validator information is temporarily unavailable

### Requirement 4: Guardian Risk Assessment

**User Story:** As a risk-averse user, I want to see clear risk warnings before signing any transaction, so that I never accidentally lose money to slippage or over-concentration.

#### Acceptance Criteria

1. WHEN a PTB is compiled, THE Guardian SHALL analyze the transaction for slippage risk and complete the analysis within 1 second before the preview is shown to the User
2. WHEN a PTB is compiled, THE Guardian SHALL analyze the transaction for concentration risk based on the User's current portfolio balances (all tokens held in the connected wallet valued at current market prices) before the preview is shown to the User
3. WHEN the price impact of a swap exceeds 1%, THE Guardian SHALL flag a slippage warning including the price impact percentage and estimated dollar loss compared to spot price
4. WHEN a swap would result in a single asset comprising more than 70% of the User's total portfolio value (all tokens held in the connected wallet valued at current market prices), THE Guardian SHALL flag a concentration risk warning including the resulting portfolio percentage
5. WHEN risks are detected, THE Guardian SHALL provide a plain-language explanation (one sentence describing the risk in non-technical terms) for each risk and an actionable suggestion describing a specific alternative action the User could take
6. WHEN no risks are detected, THE Guardian SHALL return a "safe" assessment so the preview can display a clean confirmation
7. WHEN a compiled PTB is a non-swap transaction (e.g. stake), THE Guardian SHALL skip the slippage check and only perform the concentration risk check
8. IF the Guardian cannot retrieve the User's portfolio balances to perform the concentration risk check, THEN THE Guardian SHALL skip the concentration check, proceed with any applicable slippage check, and include a notice that concentration risk could not be assessed

### Requirement 5: Human-Readable PTB Preview and Explicit Confirmation

**User Story:** As a cautious user, I want to see exactly what a transaction will do in plain language and explicitly confirm before anything executes, so that I remain in full control of my funds.

#### Acceptance Criteria

1. WHEN a PTB and its Guardian assessment are ready, THE Preview_Renderer SHALL display a numbered list of steps where each step describes one PTB operation using an action verb, token names, and numeric amounts (e.g. "Swap 100 USDC → ~24.8 SUI via Cetus")
2. THE Preview_Renderer SHALL display transaction metadata relevant to the action type: for swaps — exchange rate, minimum received amount, price impact percentage, and estimated gas fee; for stakes — validator name, estimated APY, and estimated gas fee
3. WHEN the Guardian has flagged risks, THE Preview_Renderer SHALL display each risk warning with a severity indicator (warning, elevated, or danger), a plain-language explanation of the risk, and an actionable suggestion for mitigation
4. THE Preview_Renderer SHALL display a "Confirm" button and a "Cancel" button, SHALL NOT execute any transaction until the User clicks "Confirm", and SHALL disable the "Confirm" button immediately after the User clicks it to prevent duplicate submissions
5. WHEN the User clicks "Cancel", THE Preview_Renderer SHALL dismiss the preview and return to the chat input state with the input bar enabled and no preview card visible
6. WHEN risks are present, THE Preview_Renderer SHALL change the confirm button label to "Confirm Anyway" and apply a visually distinct style that differentiates it from the standard confirm button to signal acknowledged risk
7. WHEN the Guardian assessment is "safe" with no risks detected, THE Preview_Renderer SHALL display a positive safety indicator (e.g. "No risks detected") within the preview card

### Requirement 6: Transaction Execution and Feedback

**User Story:** As a token holder, I want clear feedback after my transaction executes, so that I know whether it succeeded and can verify it on-chain.

#### Acceptance Criteria

1. WHEN the User clicks "Confirm", THE Copilot SHALL submit the PTB to the User's connected wallet for signing and broadcast to Sui Testnet
2. WHILE the transaction is being signed and confirmed, THE Copilot SHALL display a loading state with status messages reflecting the current phase: wallet signature pending, submission to network, and awaiting confirmation
3. WHEN the transaction succeeds, THE Copilot SHALL display a success message including: action summary, actual amounts transferred, the transaction digest truncated to the first 8 and last 4 characters, and a clickable link to the transaction on Sui Explorer
4. IF the transaction fails on-chain, THEN THE Copilot SHALL display an error message describing the failure reason in non-technical language and a suggestion for an alternative action the User can attempt
5. WHEN a transaction succeeds, THE Memory_Service SHALL store the action details and outcome for future recall
6. IF the User rejects the wallet signature request, THEN THE Copilot SHALL dismiss the loading state, display a message indicating the transaction was cancelled by the User, and return to the chat input state without modifying any data
7. IF the transaction is not confirmed within 60 seconds of submission, THEN THE Copilot SHALL dismiss the loading state, display a timeout message indicating the transaction could not be confirmed, and advise the User to check Sui Explorer for the transaction status

### Requirement 7: Wallet Connection and Balance Display

**User Story:** As a token holder, I want to connect my Sui wallet and see my balances, so that the Copilot can operate on my behalf with my authorization.

#### Acceptance Criteria

1. THE Copilot SHALL provide a "Connect Wallet" button supporting the Sui wallet standard (Sui Wallet, Suiet)
2. WHEN a wallet is connected, THE Copilot SHALL display the wallet address truncated to the first 4 and last 4 hex characters (e.g. "0x1a2b...3c4d") and the SUI balance rounded to 2 decimal places in the header
3. WHILE no wallet is connected, THE Copilot SHALL disable the chat input and display a prompt to connect the wallet
4. THE Copilot SHALL sign all transactions using the User's connected wallet — the Copilot SHALL NOT hold or manage private keys
5. IF the wallet connection is rejected by the User or fails due to a wallet error, THEN THE Copilot SHALL remain in the disconnected state and display an error message indicating the connection was unsuccessful
6. IF the wallet disconnects during an active session (e.g. user disconnects manually or extension becomes unavailable), THEN THE Copilot SHALL return to the disconnected state, disable the chat input, and display the prompt to reconnect

### Requirement 8: Persistent Memory via Walrus (MemWal)

**User Story:** As a returning user, I want the Copilot to remember my preferences and past actions across sessions, so that I do not repeat myself every time.

#### Acceptance Criteria

1. WHEN a transaction completes successfully, THE Memory_Service SHALL store a memory record containing action type, tokens, amounts, protocol used, and outcome to MemWal keyed by the User's wallet address within 5 seconds of transaction confirmation
2. WHEN the User expresses a preference (e.g. "I prefer Cetus"), THE Memory_Service SHALL store it as a preference memory to MemWal, and IF a preference of the same category already exists, THEN THE Memory_Service SHALL overwrite the previous value with the new preference
3. WHEN a User submits a new intent, THE Memory_Service SHALL recall the User's stored preferences and the most recent 10 transaction records from MemWal before the Intent_Parser processes the message
4. WHEN the User closes the browser and reopens the application in a new session, THE Memory_Service SHALL successfully recall previously stored memories from MemWal using the same wallet address, demonstrating cross-session persistence
5. WHEN a recalled preference or past action is applied to the current intent (e.g. preferred DEX used as default), THE Copilot SHALL display a memory indicator in the chat stating which preference was applied and its source so the User understands why a default was chosen
6. IF the Memory_Service fails to store a memory record after a successful transaction, THEN THE Memory_Service SHALL fail silently without affecting the transaction success display to the User

### Requirement 9: Memory Makes the Agent More Useful

**User Story:** As a returning user, I want the Copilot to require fewer questions in subsequent sessions, so that I experience tangible benefit from the memory system.

#### Acceptance Criteria

1. WHEN the Memory_Service recalls a User's DEX preference and the User requests a swap without specifying a DEX, THE Intent_Parser SHALL use the stored preference and skip the clarification question
2. WHEN the Memory_Service recalls the User's transaction history from the last 30 days, THE Guardian SHALL calculate cumulative concentration by combining the pending transaction's effect with prior transactions, and SHALL flag a concentration risk warning when the combined exposure to a single asset would exceed 70% of the User's total portfolio value
3. WHEN a first-time User requests a swap without specifying a DEX, THE Intent_Parser SHALL ask a clarification question requesting the User's DEX preference, AND WHEN the same User makes the same request in a subsequent session after the preference has been stored, THE Intent_Parser SHALL proceed without asking for DEX preference
4. IF the Memory_Service recalls a stored DEX preference but the preferred DEX has no available route for the requested token pair, THEN THE Intent_Parser SHALL fall back to querying all available DEXes and SHALL inform the User that the preferred DEX was unavailable for this pair

### Requirement 10: Chat Interface and Conversational UX

**User Story:** As a non-technical user, I want a simple chat interface to interact with DeFi, so that the experience feels as natural as messaging an assistant.

#### Acceptance Criteria

1. THE Copilot SHALL render messages in a conversational chat layout with User messages right-aligned and Assistant messages left-aligned, each with a visually distinct background color
2. WHILE the Copilot is processing a User's message, THE Copilot SHALL display an animated typing indicator with contextual status text (e.g. "Parsing intent...", "Compiling transaction...", "Checking risks...")
3. WHEN the User presses Enter or clicks the Send button, IF the message input is non-empty after trimming whitespace, THEN THE Copilot SHALL submit the message for processing
4. WHILE the Copilot is processing a message, THE Copilot SHALL disable the input bar and Send button to prevent duplicate submissions
5. WHEN new content appears in the chat and the User has not manually scrolled up, THE Copilot SHALL auto-scroll the chat to the most recent message
6. WHEN processing of a User's message completes, whether resulting in success, error, or clarification, THE Copilot SHALL re-enable the input bar and Send button within 1 second of the response being rendered

### Requirement 11: Graceful Degradation Without Memory

**User Story:** As a user, I want the Copilot to remain functional even if the memory system is unavailable, so that I can still execute transactions.

#### Acceptance Criteria

1. IF the Memory_Service fails to connect to MemWal or does not respond within 5 seconds, THEN THE Copilot SHALL proceed with intent parsing and PTB compilation without memory context
2. IF the Memory_Service is unavailable, THEN THE Copilot SHALL behave as a first-time-user experience (asking clarification questions as needed) without displaying error messages about memory failure to the User
3. IF a memory store operation fails after a successful transaction, THEN THE Copilot SHALL still display the transaction success message to the User and log the memory failure silently to the application console
4. IF the Memory_Service fails during recall (before intent parsing), THEN THE Copilot SHALL proceed with intent parsing using an empty memory context and SHALL NOT block the User's request

### Requirement 12: Single Merged LLM Call Architecture

**User Story:** As a user, I want fast responses from the Copilot, so that the experience feels responsive and not sluggish.

#### Acceptance Criteria

1. THE Intent_Parser SHALL use a single LLM call (Claude Sonnet via AWS Bedrock) that merges intent reasoning and initial risk flagging into one request, and the end-to-end latency from message submission to preview display SHALL be below 5 seconds
2. THE Copilot SHALL provide the LLM with the User's message, the most recent 10 recalled memories from the Memory_Service, and current wallet token balances in a single request context
3. WHEN the LLM response is received, THE Copilot SHALL extract the structured intent object (action type, tokens, amount) and preliminary risk signals (slippage concern flag and concentration concern flag with brief rationale for each) from the single response before proceeding to PTB compilation
4. IF the LLM call fails or does not return a response within 8 seconds, THEN THE Intent_Parser SHALL return an error message indicating that the request could not be processed and invite the User to try again

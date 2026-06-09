---
inclusion: fileMatch
fileMatchPattern: "**/*prompt*,**/*llm*,backend/src/services/intent-parser*"
---

# LLM Prompt Engineering Rules

## System Prompt Design

The Marina Copilot uses a single merged LLM call (Claude Sonnet via Bedrock) that combines intent reasoning + risk flagging. The system prompt must:

1. Define the AI's role clearly (DeFi financial advisor on Sui)
2. List available actions with current market data
3. Specify exact JSON output schema
4. Include user's memory context and balances
5. Set behavioral constraints (what NOT to do)

## Output Schema

LLM must always return valid JSON matching `IntentParserOutput`:

```json
{
  "reasoning": "Brief analysis of what user wants",
  "intent": { "action": "swap", "fromToken": "USDC", "toToken": "SUI", "amount": 100 },
  "clarification": null,
  "riskFlags": {
    "slippageConcern": false,
    "concentrationConcern": true,
    "rationale": "This would put 75% of portfolio in SUI"
  },
  "memoryIndicator": "Using Cetus (your preferred DEX)"
}
```

## Prompt Rules

- NEVER put secrets or API keys in prompts
- NEVER let user input inject into system prompt unescaped — sanitize
- Keep system prompt under 2000 tokens to leave room for context
- Include examples of edge cases in the system prompt (ambiguous inputs, unsupported actions)
- Specify that LLM should return `intent: null` + `clarification: "..."` when uncertain — never guess amounts or tokens

## Token Budget

| Section | ~Tokens |
|---------|---------|
| System prompt | 800 |
| User memories (10 max) | 200 |
| Wallet balances | 50 |
| Conversation history (last 3 msgs) | 150 |
| User message | 50 |
| **Total input** | **~1250** |
| **Expected output** | **~300** |

Total: ~1550 tokens per interaction → latency ~2-3s on Claude Sonnet

## Testing LLM Prompts

- Test with representative inputs (clear intent, vague goal, unsupported action, edge cases)
- Validate JSON output parses correctly with zod schema
- If LLM returns malformed JSON, retry once — if still fails, return error to user
- Log all LLM inputs/outputs in dev mode for debugging (never in production)

## Updating Prompts

When modifying the system prompt:
1. Run the existing integration test suite first to capture baseline
2. Make the change
3. Re-run tests — check for regressions in intent parsing accuracy
4. Test edge cases manually: empty message, very long message, non-English input

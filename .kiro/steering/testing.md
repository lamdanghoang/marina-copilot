---
inclusion: fileMatch
fileMatchPattern: "**/*.test.*,**/*.spec.*,**/tests/**"
---

# Testing Rules

## Property-Based Tests (fast-check)

Used for deterministic logic in backend services (Guardian, PTB Compiler, Intent Parser).

```typescript
import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';

describe('Feature: marina-copilot-hackathon, Property 8: Guardian slippage detection', () => {
  it.prop([fc.float({ min: 1.01, max: 100 })])('flags slippage when impact > 1%', (priceImpact) => {
    const result = assessRisks({ priceImpact, ... });
    expect(result.risks).toContainEqual(expect.objectContaining({ class: 'HIGH_SLIPPAGE' }));
  });
});
```

### Rules
- Minimum 100 iterations per property (default in fast-check)
- Tag each test: `Feature: marina-copilot-hackathon, Property {N}: {title}`
- Generators should cover edge cases: 0, negative, max values, empty strings
- Test pure functions — mock external services (Cetus, Bedrock, MemWal)

## Unit Tests (vitest)

Used for UI components, store actions, and formatting utilities.

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('ChatMessage', () => {
  it('renders user message right-aligned', () => {
    render(<ChatMessage message={userMsg} />);
    expect(screen.getByText('swap 100 USDC')).toHaveClass('text-right');
  });
});
```

### Rules
- One describe block per function/component
- Test behavior, not implementation details
- Mock external services with `vi.mock()`
- Use `@testing-library/react` for component tests (query by role/text, not test-ids)

## Integration Tests

Used for verifying external service interactions (run with real testnet when possible).

### Rules
- Mark with `.integration.test.ts` suffix
- May be slow — separate from unit test suite
- Use real Sui Testnet RPC for PTB dry-run validation
- Mock MemWal and Bedrock in CI, test with real services locally

## Test Organization

```
backend/tests/
├── properties/       # Property-based (fast-check) — deterministic logic
├── unit/             # Unit — service functions in isolation
├── integration/      # Integration — real external services
└── edge-cases/       # Timeouts, degradation, error paths

frontend/tests/
└── unit/             # Component rendering, store actions
```

## Running

```bash
cd backend && npm run test              # All backend tests
cd backend && npm run test:props        # Property tests only
cd frontend && npm run test             # All frontend tests
```

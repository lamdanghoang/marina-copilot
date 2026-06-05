---
inclusion: fileMatch
fileMatchPattern: "**/*.ts,**/*.tsx"
---

# TypeScript Strict Mode Rules

## When Writing TypeScript

- NEVER use `any` — use `unknown` if type is uncertain, then narrow with type guard
- NEVER use `!` (non-null assertion) — use optional chaining `?.` or guard check
- NEVER use `as` cast unless data is validated (e.g., after JSON.parse + zod validation)
- Prefer `interface` for object shapes, `type` for unions/intersections
- Export types from `src/types/index.ts` — import from there

## Error Handling Pattern

```typescript
// Services NEVER throw — return typed result
type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

// Or use nullable pattern
async function compileSwap(intent: SwapIntent): Promise<PTBCompilerOutput | AppError> {
  // ...
}
```

## Async/Await

- Always wrap external calls in try-catch with timeout
- Use `AbortController` for fetch timeouts
- NEVER use `.then().catch()` chains — use async/await

## Import Style

- Use named imports, NEVER use `import *`
- Group imports: external libs → internal modules → types → constants
- Relative imports use `./` or `../`, NEVER use absolute paths unless path aliases are configured

## Function Style

- Prefer named function declarations for top-level exports
- Prefer arrow functions for callbacks and inline logic
- Functions < 50 lines — if longer, extract into smaller functions

---
inclusion: fileMatch
fileMatchPattern: "frontend/src/components/**"
---

# React Component Rules

## Component Structure

Every component file follows this order:
1. Imports (external → internal → types → constants)
2. Type definitions (Props interface)
3. Component function
4. Export

```typescript
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/types'

interface ChatBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
}

export function ChatBubble({ message, onRetry }: ChatBubbleProps) {
  // ...
}
```

## Rules

- One component per file (exception: small sub-components used only by parent)
- Props interface named `{ComponentName}Props`
- Destructure props in function signature
- Keep components under 150 lines — extract hooks or sub-components if larger
- Use `export function` (named export), not `export default`

## shadcn/ui Usage

- Import from `@/components/ui/` — never copy-paste shadcn source
- Available components: Button, Card, Input, Badge, Dialog, Tooltip
- Customize via Tailwind classes on the component, not by editing shadcn source

## Tailwind Patterns

- Use semantic color classes: `bg-green-500/10` for success, `bg-red-500/10` for error, `bg-yellow-500/10` for warning
- Spacing: prefer `gap-*` in flex/grid over margin
- Text: `text-sm` for body, `text-xs` for metadata, `text-base` for headings within cards
- Dark mode: not required for MVP (desktop-only, light theme)

## Accessibility

- All interactive elements must have accessible labels (aria-label or visible text)
- Buttons must have `disabled` state when action unavailable
- Loading states must have `aria-busy="true"`
- Risk warnings must use `role="alert"`

## State Management

- Local UI state (hover, open/closed): `useState`
- Global app state (messages, wallet, preview): zustand store
- Server state (balances, on-chain data): fetched and stored in zustand
- NEVER prop-drill more than 2 levels — use store or context

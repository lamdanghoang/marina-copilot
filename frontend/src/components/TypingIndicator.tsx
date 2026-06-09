"use client";

interface TypingIndicatorProps {
  statusText?: string;
}

export function TypingIndicator({ statusText }: TypingIndicatorProps) {
  return (
    <div className="flex items-start gap-1.5" aria-busy="true" aria-label="Assistant is typing">
      <span className="ml-1 text-[10px] uppercase tracking-widest text-primary opacity-70">
        Marina
      </span>
      <div className="mt-4 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/40" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/40 [animation-delay:75ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/40 [animation-delay:150ms]" />
        </div>
        {statusText && (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {statusText}
          </span>
        )}
      </div>
    </div>
  );
}

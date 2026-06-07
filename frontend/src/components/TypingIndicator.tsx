"use client";

interface TypingIndicatorProps {
  statusText?: string;
}

export function TypingIndicator({ statusText }: TypingIndicatorProps) {
  return (
    <div className="flex justify-start" aria-busy="true" aria-label="Assistant is typing">
      <div className="rounded-lg bg-muted px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
        </div>
        {statusText && (
          <p className="mt-1.5 text-xs text-muted-foreground transition-opacity duration-300 ease-in-out">
            {statusText}
          </p>
        )}
      </div>
    </div>
  );
}

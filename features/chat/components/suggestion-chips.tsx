"use client";

import { cn } from "@/lib/utils";

type Props = {
  readonly suggestions: readonly string[];
  readonly disabled: boolean;
  readonly align: "start" | "center";
  readonly onSelect: (suggestion: string) => void;
};

/** One-tap starters, shown only while the thread is still empty. */
export function SuggestionChips({ suggestions, disabled, align, onSelect }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div
      className={cn("flex flex-wrap gap-2", align === "start" ? "justify-start" : "justify-center")}
    >
      {suggestions.map((suggestion) => (
        <button
          className="rounded-full border bg-card px-3.5 py-2 text-left text-muted-foreground text-xs transition-colors hover:border-foreground/25 hover:bg-secondary hover:text-foreground active:translate-y-px disabled:opacity-50"
          disabled={disabled}
          key={suggestion}
          onClick={() => onSelect(suggestion)}
          type="button"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/** Chips size themselves to their text; this keeps them from collapsing or running off. */
export const widthOf = (value: string) => `${Math.min(28, Math.max(4, value.length + 1))}ch`;

export const split = (text: string) =>
  text
    .split(/[,\n;]/)
    .map((part) => part.trim())
    .filter(Boolean);

/** One editable chip: type in it to rename, the × removes it. */
export function Chip({
  value,
  label,
  onChange,
  onRemove,
}: {
  readonly value: string;
  readonly label: string;
  readonly onChange: (next: string) => void;
  readonly onRemove: () => void;
}) {
  return (
    <span className="flex items-center gap-0.5 rounded-lg border bg-card py-1 pr-1 pl-2 focus-within:border-foreground/30">
      <input
        aria-label={label}
        className="bg-transparent text-sm outline-none"
        onChange={(event) => onChange(event.target.value)}
        style={{ width: widthOf(value) }}
        value={value}
      />
      <button
        aria-label={`Remove ${value}`}
        className="rounded p-0.5 text-muted-foreground/60 hover:bg-secondary hover:text-destructive"
        onClick={onRemove}
        type="button"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}

/**
 * The chip you type into. Commas commit, so pasting a CV's own
 * "TypeScript, Go, Postgres" line fills three chips in one go.
 */
export function AddChip({
  placeholder,
  onAdd,
  onBackspace,
}: {
  readonly placeholder: string;
  readonly onAdd: (text: string) => void;
  readonly onBackspace: () => void;
}) {
  const [text, setText] = useState("");

  const commit = () => {
    if (text.trim()) onAdd(text);
    setText("");
  };

  return (
    <input
      className={cn(
        "min-w-36 flex-1 rounded-lg border border-dashed bg-transparent px-2 py-1 text-sm",
        "placeholder:text-muted-foreground/70 focus:border-solid focus:border-foreground/30 focus:outline-none",
      )}
      onBlur={commit}
      onChange={(event) => {
        // A comma means the entry before it is finished.
        if (event.target.value.includes(",")) {
          onAdd(event.target.value);
          setText("");
          return;
        }
        setText(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Backspace" && text === "") onBackspace();
      }}
      placeholder={placeholder}
      value={text}
    />
  );
}

/**
 * Chips over a comma-separated string — what the form already stores for a
 * role's tech stack. Typing commas into a plain text input gave no feedback on
 * where one entry ended and the next began; these are the exact values the CV
 * writer is allowed to claim, so seeing them as discrete things matters.
 */
export function TagsField({
  value,
  onChange,
  placeholder,
  label,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly placeholder: string;
  readonly label: string;
}) {
  const tags = split(value);
  const write = (next: string[]) => onChange(next.join(", "));

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-field/50 p-2">
      {tags.map((tag, index) => (
        <Chip
          key={index}
          label={label}
          onChange={(next) => write(tags.map((t, i) => (i === index ? next : t)))}
          onRemove={() => write(tags.filter((_, i) => i !== index))}
          value={tag}
        />
      ))}
      <AddChip
        onAdd={(text) => {
          const taken = new Set(tags.map((t) => t.toLowerCase()));
          write([...tags, ...split(text).filter((t) => !taken.has(t.toLowerCase()))]);
        }}
        onBackspace={() => write(tags.slice(0, -1))}
        placeholder={placeholder}
      />
    </div>
  );
}

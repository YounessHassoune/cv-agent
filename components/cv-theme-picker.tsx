"use client";

import { CV_THEME_LIST, isCustomAccent } from "@/lib/cv-templates";
import { cn } from "@/lib/utils";

/** Where the colour input starts when the current theme is a preset. */
const STARTING_POINT = "#1d4ed8";

/**
 * The presets, then a colour of your own. One row, because the choice is the
 * colour: a dropdown of names would make you open it to find out what "Plum"
 * looks like.
 *
 * The custom swatch is a native `<input type="color">` — the platform already
 * has a colour picker on every desktop and phone, and it is a better one than
 * anything worth building here.
 */
export function CvThemePicker({
  value,
  onChange,
  className,
  size = "default",
}: {
  /** A preset id, or a `#rrggbb` the user picked. */
  readonly value: string;
  readonly onChange: (theme: string) => void;
  readonly className?: string;
  readonly size?: "sm" | "default";
}) {
  const custom = isCustomAccent(value);
  const dot = size === "sm" ? "size-4.5" : "size-5";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full border bg-card px-1.5 py-1",
        className,
      )}
    >
      {CV_THEME_LIST.map((option) => (
        <button
          aria-label={`${option.label} — ${option.description}`}
          aria-pressed={value === option.id}
          className={cn(
            dot,
            "rounded-full border transition-[transform,box-shadow]",
            value === option.id
              ? "scale-110 border-foreground/40 ring-2 ring-foreground/15"
              : "border-black/10 hover:scale-105",
          )}
          key={option.id}
          onClick={() => onChange(option.id)}
          style={{
            background:
              option.accent ?? "linear-gradient(135deg, #ffffff 0 50%, #1f1f1f 50% 100%)",
          }}
          title={option.label}
          type="button"
        />
      ))}

      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />

      {/* The input is the swatch: it carries the chosen colour as its own
          background, and clicking it opens the system picker. */}
      <label
        className={cn(
          dot,
          "relative cursor-pointer overflow-hidden rounded-full border transition-[transform,box-shadow]",
          custom
            ? "scale-110 border-foreground/40 ring-2 ring-foreground/15"
            : "border-black/10 hover:scale-105",
        )}
        style={{
          background: custom
            ? value
            : "conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #6366f1, #ec4899, #ef4444)",
        }}
        title="Pick your own colour"
      >
        <span className="sr-only">Custom colour</span>
        <input
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={custom ? value : STARTING_POINT}
        />
      </label>
    </div>
  );
}

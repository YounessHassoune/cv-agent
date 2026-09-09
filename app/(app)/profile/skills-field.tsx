"use client";

import { useMemo, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddChip, Chip, split } from "./tags-field";

export type Skill = { name: string; category: string };

/**
 * Skills as chips grouped by the CV's own headings, rather than one row of two
 * inputs per skill. An imported CV routinely carries fifty of them, which as
 * rows meant fifty lines of form to scroll past, each one a cramped name box
 * beside a narrower category box. As chips the same fifty fit in a few lines,
 * the category is written once per group instead of once per skill, and adding
 * ten skills is one line of typing with commas.
 */
export function SkillsField({
  value,
  onChange,
}: {
  readonly value: Skill[];
  readonly onChange: (next: Skill[]) => void;
}) {
  // A group the user just created holds no skills yet, so it cannot be derived
  // from the list — it lives here until something is typed into it.
  const [empty, setEmpty] = useState<string[]>([]);

  const groups = useMemo(() => {
    const map = new Map<string, { skill: Skill; index: number }[]>();
    value.forEach((skill, index) => {
      const key = skill.category.trim();
      map.set(key, [...(map.get(key) ?? []), { skill, index }]);
    });
    for (const key of empty) if (!map.has(key)) map.set(key, []);
    return [...map.entries()];
  }, [value, empty]);

  const replace = (index: number, values: Partial<Skill>) => {
    const next = [...value];
    next[index] = { ...next[index], ...values };
    onChange(next);
  };

  const add = (category: string, text: string) => {
    const taken = new Set(value.map((s) => s.name.trim().toLowerCase()));
    const fresh = split(text).filter((name) => {
      const key = name.toLowerCase();
      if (taken.has(key)) return false;
      taken.add(key);
      return true;
    });
    if (fresh.length > 0) onChange([...value, ...fresh.map((name) => ({ name, category }))]);
  };

  const renameGroup = (from: string, to: string) => {
    setEmpty((groups) => groups.map((name) => (name === from ? to : name)));
    onChange(value.map((s) => (s.category.trim() === from ? { ...s, category: to } : s)));
  };

  const removeGroup = (key: string) => {
    setEmpty((groups) => groups.filter((name) => name !== key));
    onChange(value.filter((s) => s.category.trim() !== key));
  };

  return (
    <div className="space-y-3">
      {groups.map(([category, items]) => (
        <div className="rounded-xl border bg-field/50 p-3" key={category}>
          <div className="mb-2.5 flex items-center gap-2">
            <Input
              aria-label="Category"
              className="h-7 flex-1 border-0 bg-transparent px-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide shadow-none focus-visible:bg-secondary"
              onChange={(event) => renameGroup(category, event.target.value)}
              placeholder="Category (optional)"
              value={category}
            />
            <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
              {items.length}
            </span>
            <Button
              aria-label={`Remove ${category || "ungrouped"} skills`}
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeGroup(category)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {items.map(({ skill, index }) => (
              <Chip
                key={index}
                label="Skill"
                onChange={(name) => replace(index, { name })}
                onRemove={() => onChange(value.filter((_, x) => x !== index))}
                value={skill.name}
              />
            ))}

            <AddChip
              onAdd={(text) => add(category, text)}
              onBackspace={() => {
                const last = items.at(-1);
                if (last) onChange(value.filter((_, x) => x !== last.index));
              }}
              placeholder="Add skills, separated by commas"
            />
          </div>
        </div>
      ))}

      <Button
        className="w-full border-dashed"
        onClick={() => setEmpty((groups) => [...groups, ""])}
        disabled={groups.some(([category]) => category === "")}
        type="button"
        variant="outline"
      >
        <PlusIcon className="size-4" /> Add a category
      </Button>
    </div>
  );
}

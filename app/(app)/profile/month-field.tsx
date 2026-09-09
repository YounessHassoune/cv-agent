"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A CV date is a month and a year — "March 2021", never the 14th. So this picks
 * a month off a grid instead of a day off a calendar: `<input type="date">`
 * made you choose a day nobody has (the importer padded every date to the 1st
 * and the preview stripped it off again), and a day-precision calendar would
 * put that day straight back.
 *
 * The stored value keeps its `YYYY-MM-DD` shape, always on the 1st, so the
 * importer, the API's validation, the PDF and the ATS scoring see what they
 * always saw.
 */
const MONTHS = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleString("en", { month: "short" }),
);

/** The year grid shows a dozen at a time — a career fits in two pages of it. */
const YEAR_PAGE = 12;

const parse = (value: string) => {
  const [year, month] = value ? value.split("-") : [];
  return { year: Number(year) || 0, month: Number(month) || 0 };
};

const label = (value: string, empty: string) => {
  const { year, month } = parse(value);
  return year && month ? `${MONTHS[month - 1]} ${year}` : empty;
};

export function MonthField({
  value,
  onChange,
  emptyLabel = "—",
}: {
  /** `YYYY-MM-DD`, or "" for none. */
  readonly value: string;
  readonly onChange: (next: string) => void;
  /** What an unset date means here: "Present" for an end date. */
  readonly emptyLabel?: string;
}) {
  const selected = parse(value);
  const thisYear = new Date().getFullYear();

  const [open, setOpen] = useState(false);
  // Which year the grid is showing, which is not necessarily the selected one.
  const [shown, setShown] = useState(selected.year || thisYear);
  const [picking, setPicking] = useState<"month" | "year">("month");

  // Opening on an unrelated year (after an import, say) is disorienting.
  useEffect(() => {
    if (open) {
      setShown(parse(value).year || thisYear);
      setPicking("month");
    }
  }, [open, value, thisYear]);

  const choose = (month: number) => {
    onChange(`${shown}-${String(month).padStart(2, "0")}-01`);
    setOpen(false);
  };

  const firstYear = shown - (((shown % YEAR_PAGE) + YEAR_PAGE) % YEAR_PAGE);
  const years = Array.from({ length: YEAR_PAGE }, (_, index) => firstYear + index);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <button
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none",
              "hover:bg-secondary/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 dark:bg-input/25",
              !value && "text-muted-foreground",
            )}
            type="button"
          >
            <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{label(value, emptyLabel)}</span>
          </button>
        }
      />

      <PopoverContent className="w-64 p-2">
        <div className="mb-2 flex items-center gap-1">
          <Button
            aria-label={picking === "month" ? "Previous year" : "Previous years"}
            className="size-7"
            onClick={() => setShown((year) => year - (picking === "month" ? 1 : YEAR_PAGE))}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>

          {/* The year is the button, because scrolling one year at a time back
              to 2008 is nobody's idea of a picker. */}
          <Button
            className="h-7 flex-1 font-medium text-sm tabular-nums"
            onClick={() => setPicking((mode) => (mode === "month" ? "year" : "month"))}
            size="sm"
            type="button"
            variant="ghost"
          >
            {picking === "month" ? shown : `${years[0]} – ${years[years.length - 1]}`}
          </Button>

          <Button
            aria-label={picking === "month" ? "Next year" : "Next years"}
            className="size-7"
            onClick={() => setShown((year) => year + (picking === "month" ? 1 : YEAR_PAGE))}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {picking === "month"
            ? MONTHS.map((name, index) => {
                const month = index + 1;
                const isSelected = selected.year === shown && selected.month === month;
                return (
                  <button
                    aria-pressed={isSelected}
                    className={cn(
                      "rounded-lg py-1.5 text-sm transition-colors",
                      isSelected
                        ? "bg-primary font-medium text-primary-foreground"
                        : "hover:bg-secondary",
                    )}
                    key={name}
                    onClick={() => choose(month)}
                    type="button"
                  >
                    {name}
                  </button>
                );
              })
            : years.map((year) => (
                <button
                  aria-pressed={selected.year === year}
                  className={cn(
                    "rounded-lg py-1.5 text-sm tabular-nums transition-colors",
                    selected.year === year
                      ? "bg-primary font-medium text-primary-foreground"
                      : "hover:bg-secondary",
                  )}
                  key={year}
                  onClick={() => {
                    setShown(year);
                    setPicking("month");
                  }}
                  type="button"
                >
                  {year}
                </button>
              ))}
        </div>

        {/* Clearing is how you say "still here" on an end date, so it is a
            button rather than a blank option buried in a list. */}
        <Button
          className="mt-2 w-full"
          disabled={!value}
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          {emptyLabel === "—" ? "Clear" : emptyLabel}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { FileUpIcon, Loader2Icon, UploadIcon } from "lucide-react";

import type { ImportedProfile } from "@/agent/lib/cv-import-schema.ts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ProfileForm } from "./profile-editor";

const ACCEPT = ".pdf,.docx,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

/** The date inputs want a full day; CVs only ever give a month. */
function toDateInput(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
  return "";
}

/**
 * Imported values win where the CV had something, and the existing form keeps
 * the rest — the account email is already prefilled, and no CV carries a photo
 * or a template choice.
 */
function merge(current: ProfileForm, imported: ImportedProfile): ProfileForm {
  const pick = <T,>(next: T[], fallback: T[]) => (next.length > 0 ? next : fallback);

  return {
    ...current,
    fullName: imported.fullName || current.fullName,
    headline: imported.headline || current.headline,
    summary: imported.summary || current.summary,
    contact: {
      email: imported.contact.email || current.contact.email,
      phone: imported.contact.phone || current.contact.phone,
      location: imported.contact.location || current.contact.location,
      links: pick(imported.contact.links.filter(Boolean), current.contact.links),
    },
    languages: pick(
      imported.languages.filter((l) => l.name.trim()),
      current.languages,
    ),
    education: pick(
      imported.education
        .filter((e) => e.institution.trim() || e.degree.trim())
        .map((e) => ({
          institution: e.institution,
          degree: e.degree,
          start: toDateInput(e.start),
          end: toDateInput(e.end),
        })),
      current.education,
    ),
    skills: pick(
      imported.skills
        .filter((s) => s.name.trim())
        .map((s) => ({ name: s.name, category: s.category })),
      current.skills,
    ),
    experiences: pick(
      imported.experiences
        .filter((e) => e.company.trim() || e.role.trim())
        .map((e) => ({
          company: e.company,
          role: e.role,
          location: e.location,
          start: toDateInput(e.start),
          end: toDateInput(e.end),
          bullets: e.bullets.join("\n"),
          stack: e.stack.join(", "),
        })),
      current.experiences,
    ),
    projects: pick(
      imported.projects
        .filter((p) => p.title.trim())
        .map((p) => ({
          title: p.title,
          description: p.description,
          link: p.link,
          bullets: p.bullets.join("\n"),
          stack: p.stack.join(", "),
        })),
      current.projects,
    ),
  };
}

/** "3 roles, 12 skills and 2 degrees" — a one-glance check that it read the right file. */
function summarize(imported: ImportedProfile): string {
  const counted: string[] = [];
  const add = (n: number, one: string, many: string) => {
    if (n > 0) counted.push(`${n} ${n === 1 ? one : many}`);
  };
  add(imported.experiences.length, "role", "roles");
  add(imported.education.length, "degree", "degrees");
  add(imported.skills.length, "skill", "skills");
  add(imported.projects.length, "project", "projects");

  if (counted.length === 0) return "It didn't find any sections it recognised.";
  const last = counted.pop() as string;
  return `Found ${counted.length > 0 ? `${counted.join(", ")} and ${last}` : last}.`;
}

/** A finished import the browser never collected — see `GET /api/profile/import`. */
type Waiting = {
  readonly filename: string;
  readonly profile: ImportedProfile;
  readonly photoUrl: string | null;
};

/**
 * Import lives behind a button next to Save rather than as a card wedged above
 * the form. It is a one-off action, and a permanent panel for it pushed the
 * actual form down the page every single time the builder was opened.
 */
export function CvImportDialog({
  hasContent,
  onImport,
}: {
  /** Whether the form already holds work an import would overwrite. */
  readonly hasContent: boolean;
  readonly onImport: (apply: (current: ProfileForm) => ProfileForm) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [pending, setPending] = useState<File>();
  const [waiting, setWaiting] = useState<Waiting>();

  // A refresh or a navigation mid-parse loses the response, never the parse:
  // the route parks what it extracted and this collects it.
  useEffect(() => {
    let live = true;
    fetch("/api/profile/import")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { pending?: Waiting | null } | null) => {
        if (live && payload?.pending) {
          setWaiting(payload.pending);
          // Opened for them: a parse they already paid for has finished and is
          // waiting, and they have no reason to go looking for it.
          setOpen(true);
        }
      })
      .catch(() => {
        // Nothing waiting is the normal case; a failed check is not worth a message.
      });
    return () => {
      live = false;
    };
  }, []);

  /** The stored copy has served its purpose the moment the form has it. */
  const clearWaiting = () => {
    setWaiting(undefined);
    void fetch("/api/profile/import", { method: "DELETE" }).catch(() => {});
  };

  const apply = (imported: ImportedProfile, photoUrl: string) => {
    onImport((current) => ({ ...merge(current, imported), photoUrl: photoUrl || current.photoUrl }));
    setDone(`${summarize(imported)}${photoUrl ? " Your photo came across too." : ""}`);
  };

  const send = async (file: File) => {
    setError(undefined);
    setDone(undefined);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/profile/import", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as {
        profile?: ImportedProfile;
        photoUrl?: string | null;
        error?: string;
      };
      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? `Import failed (${response.status})`);
      }

      apply(payload.profile, payload.photoUrl ?? "");
      clearWaiting();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Couldn't read that CV.");
    } finally {
      setBusy(false);
    }
  };

  const pick = (file: File | undefined) => {
    if (!file || busy) return;
    setDone(undefined);

    if (file.size > MAX_BYTES) {
      setError("That file is over 10MB.");
      return;
    }
    // An import replaces whole sections, so anything already typed in is at risk.
    if (hasContent) {
      setPending(file);
      return;
    }
    void send(file);
  };

  /*
   * One modal with three states rather than a dialog stacked on a dialog:
   * collect a parse that finished without you, confirm an overwrite, or take a
   * file.
   */
  const body = waiting ? (
    <>
      <DialogHeader>
        <DialogTitle>Your last import finished without you</DialogTitle>
        <DialogDescription>
          We read <span className="font-medium text-foreground">{waiting.filename}</span> after you
          left the page. {summarize(waiting.profile)} Fill the form with it, or throw it away.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button onClick={clearWaiting} type="button" variant="ghost">
          Discard
        </Button>
        <Button
          onClick={() => {
            apply(waiting.profile, waiting.photoUrl ?? "");
            clearWaiting();
          }}
          type="button"
        >
          Fill the form
        </Button>
      </DialogFooter>
    </>
  ) : pending ? (
    <>
      <DialogHeader>
        <DialogTitle>Replace what you have filled in?</DialogTitle>
        <DialogDescription>
          Every section the CV covers gets overwritten with what it says. Your saved profile stays
          untouched until you press Save.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button onClick={() => setPending(undefined)} type="button" variant="ghost">
          Cancel
        </Button>
        <Button
          onClick={() => {
            const file = pending;
            setPending(undefined);
            if (file) void send(file);
          }}
          type="button"
        >
          Import and replace
        </Button>
      </DialogFooter>
    </>
  ) : (
    <>
      <DialogHeader>
        <DialogTitle>Upload your CV</DialogTitle>
        <DialogDescription>
          The fields fill themselves in from the file. Check them before saving: parsing is good,
          not perfect.
        </DialogDescription>
      </DialogHeader>

      <button
        className={cn(
          "flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
          busy ? "cursor-default" : "hover:border-foreground/25 hover:bg-secondary/60",
          dragging && "border-foreground/40 border-solid bg-secondary",
        )}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pick(event.dataTransfer.files?.[0]);
        }}
        type="button"
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-foreground">
          {busy ? <Loader2Icon className="size-5 animate-spin" /> : <FileUpIcon className="size-5" />}
        </span>
        <span className="space-y-1">
          <span className="block font-medium text-sm">
            {busy ? "Reading your CV…" : "Drop your CV here, or click to choose"}
          </span>
          <span className="block text-muted-foreground text-sm">
            {busy ? "This takes a few seconds." : "PDF or Word, up to 10MB."}
          </span>
        </span>
      </button>

      {done ? (
        <p className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
          {done} Review every section, dates especially, then press Save.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {done ? (
        <DialogFooter>
          <Button onClick={() => setOpen(false)} type="button">
            Done
          </Button>
        </DialogFooter>
      ) : null}
    </>
  );

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        // Closing abandons an overwrite prompt rather than remembering it.
        if (!next) setPending(undefined);
      }}
      open={open}
    >
      <DialogTrigger
        render={
          <Button size="sm" type="button" variant="outline">
            <UploadIcon className="size-4" />
            Upload CV
          </Button>
        }
      />
      <DialogContent className="gap-5">
        {body}

        <input
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            pick(event.target.files?.[0]);
            // Reset so picking the same file twice still fires a change.
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
      </DialogContent>
    </Dialog>
  );
}

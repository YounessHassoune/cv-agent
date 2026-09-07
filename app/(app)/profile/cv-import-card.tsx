"use client";

import { useEffect, useRef, useState } from "react";
import { FileUpIcon, Loader2Icon, SparklesIcon } from "lucide-react";

import type { ImportedProfile } from "@/agent/lib/cv-import-schema.ts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

export function CvImportCard({
  hasContent,
  onImport,
}: {
  /** Whether the form already holds work an import would overwrite. */
  readonly hasContent: boolean;
  readonly onImport: (apply: (current: ProfileForm) => ProfileForm) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
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
        if (live && payload?.pending) setWaiting(payload.pending);
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

  return (
    <>
      {waiting && !busy ? (
        <div className="surface-card space-y-3 rounded-xl border-primary/30 bg-primary/5 p-5 sm:p-6">
          <div className="space-y-1">
            <p className="font-semibold text-[0.95rem]">Your last import finished without you</p>
            <p className="text-muted-foreground text-sm">
              We read <span className="font-medium">{waiting.filename}</span> after you left the
              page. {summarize(waiting.profile)} Fill the form with it, or throw it away.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                apply(waiting.profile, waiting.photoUrl ?? "");
                clearWaiting();
              }}
              type="button"
            >
              Fill the form
            </Button>
            <Button onClick={clearWaiting} type="button" variant="ghost">
              Discard
            </Button>
          </div>
        </div>
      ) : null}

      <section
        className={cn(
          "surface-card rounded-xl border-dashed p-5 transition-colors sm:p-6",
          dragging && "border-primary/60 bg-primary/5",
        )}
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
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {busy ? (
                <Loader2Icon className="size-4.5 animate-spin" />
              ) : (
                <SparklesIcon className="size-4.5" />
              )}
            </span>
            <div className="space-y-1">
              <p className="font-semibold text-[0.95rem]">
                {busy ? "Reading your CV…" : "Already have a CV?"}
              </p>
              <p className="max-w-md text-muted-foreground text-sm">
                {busy
                  ? "This takes a few seconds. Nothing is saved until you press Save."
                  : "Drop a PDF or Word file here and the fields below fill themselves in. Check them before saving — parsing is good, not perfect."}
              </p>
            </div>
          </div>

          <Button
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            type="button"
            variant="outline"
          >
            <FileUpIcon className="size-3.5" />
            Choose file
          </Button>
        </div>

        {done ? (
          <p className="mt-4 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
            {done} Review every section — dates especially — then press Save.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm">
            {error}
          </p>
        ) : null}

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
      </section>

      <Dialog onOpenChange={(open) => !open && setPending(undefined)} open={Boolean(pending)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace what you have filled in?</DialogTitle>
            <DialogDescription>
              Every section the CV covers gets overwritten with what it says. Your saved profile
              stays untouched until you press Save.
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
        </DialogContent>
      </Dialog>
    </>
  );
}

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
import { Progress } from "@/components/ui/progress";
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
 * An import replaces the profile outright. It used to keep whatever the form
 * already held wherever the CV was silent, which left fields from the previous
 * CV stranded in the new one — a headline from an old role, skills the new
 * document never mentions. Only two things survive, because no CV carries
 * them: the account email (when the CV gives none) and the template choice.
 */
function replaceWith(current: ProfileForm, imported: ImportedProfile): ProfileForm {
  return {
    template: current.template,
    photoUrl: "",
    fullName: imported.fullName,
    headline: imported.headline,
    summary: imported.summary,
    contact: {
      email: imported.contact.email || current.contact.email,
      phone: imported.contact.phone,
      location: imported.contact.location,
      links: imported.contact.links.filter(Boolean),
    },
    languages: imported.languages.filter((l) => l.name.trim()),
    education: imported.education
      .filter((e) => e.institution.trim() || e.degree.trim())
      .map((e) => ({
        institution: e.institution,
        degree: e.degree,
        start: toDateInput(e.start),
        end: toDateInput(e.end),
      })),
    skills: imported.skills
      .filter((s) => s.name.trim())
      .map((s) => ({ name: s.name, category: s.category })),
    experiences: imported.experiences
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
    projects: imported.projects
      .filter((p) => p.title.trim())
      .map((p) => ({
        title: p.title,
        description: p.description,
        link: p.link,
        bullets: p.bullets.join("\n"),
        stack: p.stack.join(", "),
      })),
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

/** Where a running parse has got to. `upload` is the client's own guess. */
type Stage = "upload" | "reading" | "parsing" | "photo";

/** Counts the model has streamed out so far. */
type Found = {
  readonly name: string;
  readonly roles: number;
  readonly skills: number;
  readonly education: number;
  readonly projects: number;
};

/** Measured end-to-end on a two-page CV with the extraction model. */
const USUAL_SECONDS = 15;

type Job = {
  readonly filename: string;
  readonly stage: Stage;
  readonly startedAt: number;
  readonly found?: Found | null;
};

/** What `GET /api/profile/import` answers with. */
type State = {
  readonly running?: Job;
  readonly pending?: Waiting | null;
  readonly failed?: { readonly filename: string; readonly error: string };
};

/**
 * A parse started in this browser. The POST it is riding on dies with the tab,
 * but the parse itself does not, so the filename is parked here and the next
 * mount polls `GET /api/profile/import` until the result shows up.
 */
const RUNNING_KEY = "cv-import:running";
const POLL_MS = 2000;
/** Five minutes of polling; a parse still missing by then is not coming. */
const POLL_LIMIT = 150;

const remember = (filename: string | null) => {
  try {
    if (filename === null) localStorage.removeItem(RUNNING_KEY);
    else localStorage.setItem(RUNNING_KEY, filename);
  } catch {
    // Private mode, blocked storage: polling is a bonus, not a requirement.
  }
};

const recall = (): string | null => {
  try {
    return localStorage.getItem(RUNNING_KEY);
  } catch {
    return null;
  }
};

/**
 * Import lives behind a button next to Save rather than as a card wedged above
 * the form. It is a one-off action, and a permanent panel for it pushed the
 * actual form down the page every single time the builder was opened.
 *
 * Picking a file closes the dialog: the parse takes a model call's worth of
 * seconds, and holding a modal open over the whole page for it blocks work the
 * user could be doing. Progress moves into the trigger button, which reopens
 * onto a progress panel, and survives a refresh through `RUNNING_KEY`.
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
  /** The parse currently in flight, or undefined when idle. */
  const [job, setJob] = useState<Job>();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<File>();
  const [waiting, setWaiting] = useState<Waiting>();
  const busy = job !== undefined;

  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Strict Mode starts two poll loops; only one of them may apply a result. */
  const claimed = useRef(false);

  // One second of arithmetic while a parse runs, nothing while idle.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!job) return;
    const tick = () => setElapsed(Math.round((Date.now() - job.startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [job]);

  /** The stored copy has served its purpose the moment the form has it. */
  const discard = () => {
    setWaiting(undefined);
    void fetch("/api/profile/import", { method: "DELETE" }).catch(() => {});
  };

  const apply = (imported: ImportedProfile, photoUrl: string) => {
    onImport((current) => ({ ...replaceWith(current, imported), photoUrl }));
    // No summary banner to dismiss: the form behind this dialog now holds the
    // CV, and the header says whether it saved. Getting out of the way is the
    // whole point of closing on upload in the first place.
    setOpen(false);
  };

  const stopBusy = () => {
    setJob(undefined);
    remember(null);
  };

  /**
   * Follows a parse to its end, whoever started it and whatever happens to this
   * page in the meantime. `mine` means this browser kicked it off, so the result
   * goes straight into the form; a result found without that (an import started
   * on another device, say) is offered rather than applied.
   */
  const watch = (mine: boolean) => {
    clearTimeout(timer.current);
    let tries = 0;

    const tick = async () => {
      const response = await fetch("/api/profile/import").catch(() => null);
      const state = response?.ok
        ? ((await response.json().catch(() => null)) as State | null)
        : null;
      if (!alive.current) return;

      // A blip on one poll is not a dead import: keep asking.
      if (!response) {
        if (++tries > POLL_LIMIT) {
          stopBusy();
          setError("Couldn't reach the server. Reload the page to pick the import back up.");
          setOpen(true);
          return;
        }
        timer.current = setTimeout(tick, POLL_MS);
        return;
      }

      if (state?.failed) {
        stopBusy();
        setError(state.failed.error);
        setOpen(true);
        return;
      }
      if (state?.pending) {
        if (claimed.current) return;
        claimed.current = true;
        stopBusy();
        if (mine) {
          apply(state.pending.profile, state.pending.photoUrl ?? "");
          discard();
        } else {
          setWaiting(state.pending);
          setOpen(true);
        }
        return;
      }

      if (response && !response.ok) {
        stopBusy();
        setError("Lost contact with the server while importing. Try again.");
        setOpen(true);
        return;
      }

      if (!state?.running) {
        // Nothing in flight. Either nothing ever was, or this browser is
        // holding a flag from an import that died with an older process —
        // either way, stop rather than spin the button for five minutes.
        stopBusy();
        return;
      }

      setJob(state.running);
      remember(state.running.filename);

      if (++tries > POLL_LIMIT) {
        stopBusy();
        setError("That import never finished. Try uploading the file again.");
        setOpen(true);
        return;
      }
      timer.current = setTimeout(tick, POLL_MS);
    };

    void tick();
  };

  // A refresh or a navigation mid-parse loses the response, never the parse:
  // the route runs it after the response and parks the result.
  useEffect(() => {
    // Set on the way in, not just cleared on the way out: React's development
    // Strict Mode mounts, unmounts and remounts, and a flag only ever cleared
    // stays false for the life of the page — which killed every poll after the
    // first mount, so the button span forever and finished imports were never
    // collected.
    alive.current = true;

    const running = recall();
    // A placeholder until the first poll says when it really started.
    if (running) setJob({ filename: running, stage: "upload", startedAt: Date.now() });
    watch(running !== null);

    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only collection
  }, []);

  const send = async (file: File) => {
    setError(undefined);
    claimed.current = false;
    setJob({ filename: file.name, stage: "upload", startedAt: Date.now() });
    // Out of the way: the parse is tracked on the button, survives a reload,
    // and no longer depends on this tab staying open.
    setOpen(false);
    remember(file.name);

    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/profile/import", { method: "POST", body }).catch(() => null);
    if (!alive.current) return;

    if (!response?.ok) {
      const payload = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
      stopBusy();
      setError(payload?.error ?? "Couldn't upload that CV.");
      setOpen(true);
      return;
    }
    watch(true);
  };

  const pick = (file: File | undefined) => {
    if (!file || busy) return;

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
   * One modal with four states rather than dialogs stacked on dialogs: collect
   * a parse that finished without you, watch one that is still running, confirm
   * an overwrite, or take a file.
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
        <Button onClick={discard} type="button" variant="ghost">
          Discard
        </Button>
        <Button
          onClick={() => {
            apply(waiting.profile, waiting.photoUrl ?? "");
            discard();
          }}
          type="button"
        >
          Fill the form
        </Button>
      </DialogFooter>
    </>
  ) : job ? (
    <>
      <DialogHeader>
        <DialogTitle>Importing your CV</DialogTitle>
        <DialogDescription className="truncate">{job.filename}</DialogDescription>
      </DialogHeader>

      {/* Not a step list: the file is read in a tenth of a second and the rest
          is one model call, so the only truthful progress is what that call has
          emitted. These counts climb as it streams and come back unchanged
          after a reload, because they are read from the server, not the page. */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium text-sm">
            {job.found?.name ? `Reading ${job.found.name}'s CV` : "Reading your CV"}
          </p>
          <p className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {elapsed}s{elapsed <= USUAL_SECONDS * 2 ? ` / ~${USUAL_SECONDS}s` : ""}
          </p>
        </div>

        <Progress
          indicatorClassName={cn(elapsed > USUAL_SECONDS * 2 && "bg-warning")}
          value={Math.min(96, (elapsed / USUAL_SECONDS) * 100)}
        />

        <div className="grid grid-cols-4 gap-px overflow-hidden rounded-xl border bg-border">
          {(
            [
              ["Roles", job.found?.roles ?? 0],
              ["Skills", job.found?.skills ?? 0],
              ["Studies", job.found?.education ?? 0],
              ["Projects", job.found?.projects ?? 0],
            ] as const
          ).map(([label, count]) => (
            <div className="bg-card px-2 py-3 text-center" key={label}>
              <p
                className={cn(
                  "font-semibold text-xl tabular-nums transition-colors",
                  count === 0 ? "text-muted-foreground/30" : "text-foreground",
                )}
              >
                {count}
              </p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground text-xs">
          {elapsed > USUAL_SECONDS * 2
            ? "Taking longer than usual — still going."
            : "Close this whenever you like. Refreshing or leaving the page is safe: the import finishes on its own and fills the form in when it lands."}
        </p>
      </div>

      <DialogFooter>
        <Button onClick={() => setOpen(false)} type="button" variant="outline">
          Keep working
        </Button>
      </DialogFooter>
    </>
  ) : pending ? (
    <>
      <DialogHeader>
        <DialogTitle>Replace what you have filled in?</DialogTitle>
        <DialogDescription>
          Your profile is replaced by what this CV says and saved straight away. Sections the CV
          does not cover are emptied rather than left as they are.
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
          Your profile is rebuilt from the file and saved. Anything the CV does not mention is
          cleared, so nothing from an older CV is left behind.
        </DialogDescription>
      </DialogHeader>

      <button
        className={cn(
          "flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
          "hover:border-foreground/25 hover:bg-secondary/60",
          dragging && "border-foreground/40 border-solid bg-secondary",
        )}
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
          <FileUpIcon className="size-5" />
        </span>
        <span className="space-y-1">
          <span className="block font-medium text-sm">Drop your CV here, or click to choose</span>
          <span className="block text-muted-foreground text-sm">PDF or Word, up to 10MB.</span>
        </span>
      </button>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm">
          {error}
        </p>
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
      {/* Still a button while a parse runs, not a disabled one: it is the only
          way back to the progress panel after the dialog gets out of the way. */}
      <DialogTrigger
        render={
          <Button size="sm" type="button" variant="outline">
            {busy ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <UploadIcon className="size-4" />
            )}
            {busy ? "Reading CV…" : "Upload CV"}
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

"use client";

import {
  FileTextIcon,
  LayoutTemplateIcon,
  PencilIcon,
  RotateCcwIcon,
  SaveIcon,
  ScrollTextIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CvPreview, type CvPreviewData } from "@/components/cv-preview";
import { CvThemePicker } from "@/components/cv-theme-picker";
import { PdfViewer } from "@/components/pdf-viewer";
import { LockPill, usePlan } from "@/components/plan-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { previewToCv } from "@/lib/cv-data";
import { CV_TEMPLATE_LIST } from "@/lib/cv-templates";
import { templateAllowed, themeAllowed } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

/**
 * The document, and only the document. It used to be one of three tabs sharing
 * a panel with the chat, which meant asking for a change hid the thing you were
 * changing. Here it holds the main column and never goes away; the chat sits
 * beside it.
 *
 * Preview, Edit and PDF are three views over the same CV rather than three
 * places it lives: Edit is the preview with every run of text typed into
 * directly, and the PDF is what the saved version renders to.
 */
export function DocumentPanel({
  applicationId,
  title,
  compiledAt,
  cv,
  hasPdf,
  language,
  template,
  onTemplateChange,
  theme,
  onThemeChange,
}: {
  readonly applicationId: string;
  readonly title: string;
  readonly cv: CvPreviewData | null;
  /** Last compile time of this variant; busts the PDF cache after a rebuild. */
  readonly compiledAt: string | null;
  readonly hasPdf: boolean;
  /** ISO code of the variant being shown; scopes the PDF view. */
  readonly language?: string;
  readonly template: string;
  readonly onTemplateChange: (template: string) => void;
  readonly theme: string;
  readonly onThemeChange: (theme: string) => void;
}) {
  const plan = usePlan();
  const router = useRouter();
  const [view, setView] = useState<"preview" | "edit" | "pdf">("preview");
  // Preview-only, exactly as in the CV builder: the compiled PDF is photo-free
  // either way, so this never reaches the document the employer receives.
  const [showPhoto, setShowPhoto] = useState(true);

  /*
   * The edited copy. It is what every view renders, so an unsaved change is
   * visible in Preview too rather than only inside the editor — the document on
   * screen is always the one you last typed into.
   */
  const [draft, setDraft] = useState<CvPreviewData | null>(cv);
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState<string>();

  // A new server render (another language, or the agent rewriting this one)
  // replaces the draft. Local edits are already saved by then, or were
  // discarded.
  useEffect(() => {
    setDraft(cv);
    setSave("idle");
    setError(undefined);
  }, [cv]);

  const shown = draft ?? cv;
  const dirty = save === "dirty" || save === "error";
  const activeTemplate = CV_TEMPLATE_LIST.find((t) => t.id === template) ?? CV_TEMPLATE_LIST[0];
  const withPhoto = showPhoto && Boolean(shown?.photoUrl);

  const pdfQuery = new URLSearchParams({ template, theme, photo: withPhoto ? "1" : "0" });
  if (language) pdfQuery.set("lang", language);
  // Same path after every recompile, so without this the browser serves the PDF
  // it already has and the user has to reload to see their own new CV.
  if (compiledAt) pdfQuery.set("v", compiledAt);
  const pdfSrc = `/api/applications/${applicationId}/pdf?${pdfQuery}`;

  const views = [
    { id: "preview" as const, label: "Preview", icon: ScrollTextIcon },
    { id: "edit" as const, label: "Edit", icon: PencilIcon },
    { id: "pdf" as const, label: "PDF", icon: FileTextIcon },
  ];

  const persist = async () => {
    if (!shown || !language) return;
    setSave("saving");
    setError(undefined);

    const response = await fetch(`/api/applications/${applicationId}/cv`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language,
        template,
        theme,
        cv: previewToCv(shown, language),
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setSave("error");
      setError(body?.error ?? `Save failed (${response.status})`);
      return;
    }

    setSave("saved");
    // The PDF and the ATS score are both recomputed server-side, so the whole
    // page is refreshed rather than any part of it patched by hand.
    router.refresh();
  };

  const saveBar =
    view === "edit" ? (
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t bg-card px-3 py-2">
        <p
          className={cn(
            "mr-auto text-xs",
            save === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {save === "saving"
            ? "Saving, re-rendering the PDF and re-scoring…"
            : save === "saved"
              ? "Saved. PDF and ATS score updated."
              : save === "error"
                ? error
                : dirty
                  ? "Unsaved changes"
                  : "Click any line to edit it."}
        </p>

        <Button
          disabled={!dirty}
          onClick={() => {
            setDraft(cv);
            setSave("idle");
            setError(undefined);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RotateCcwIcon className="size-3.5" />
          Discard
        </Button>
        <Button disabled={!dirty} onClick={persist} size="sm" type="button">
          <SaveIcon className="size-3.5" />
          {save === "saving" ? "Saving…" : "Save"}
        </Button>
      </div>
    ) : null;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-secondary/40">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-2 py-2">
        <div className="flex rounded-lg bg-muted p-[3px]">
          {views.map((item) => (
            <button
              aria-pressed={view === item.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-sm transition-colors",
                view === item.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
                item.id === "edit" && !shown ? "pointer-events-none opacity-40" : "",
              )}
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              <item.icon className="size-3.5" />
              {item.label}
              {/* The dot follows you between views: a change made in Edit is
                  still unsaved while you are looking at the PDF. */}
              {item.id === "edit" && dirty ? (
                <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
              ) : null}
            </button>
          ))}
        </div>

        {/* Only offered when there is a photo to show. The profile is where one
            is uploaded, and an inert switch here would just puzzle. */}
        {shown?.photoUrl ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Switch checked={showPhoto} id="show-photo-review" onCheckedChange={setShowPhoto} />
            <Label className="text-muted-foreground text-xs" htmlFor="show-photo-review">
              Photo
            </Label>
          </div>
        ) : null}

        {/* Base UI reports the value as `string | null` because a select can be
            cleared in general. This one has no null item, so the guard just
            satisfies the type. */}
        <Select
          onValueChange={(next) => {
            if (!next) return;
            /*
             * Locked layouts stay in the list and stay clickable. Hiding them
             * would hide the reason to upgrade, and disabling them would read
             * as a bug — picking one opens the dialog that explains it.
             */
            if (!templateAllowed(plan.plan, next)) {
              plan.upgrade("allTemplates");
              return;
            }
            onTemplateChange(next);
          }}
          value={template}
        >
          <SelectTrigger
            aria-label="CV layout"
            className={cn(
              "shrink-0 gap-1.5 rounded-lg bg-card font-medium",
              shown?.photoUrl ? "" : "ml-auto",
            )}
            size="sm"
          >
            <LayoutTemplateIcon className="size-3.5" />
            <SelectValue>{activeTemplate.label}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end" className="w-80">
            {CV_TEMPLATE_LIST.map((option) => {
              const locked = !templateAllowed(plan.plan, option.id);
              return (
                <SelectItem className="py-2" key={option.id} value={option.id}>
                  {/* The wrapper must be its own flex column: SelectItem lays its
                      last span child out as a row. */}
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 font-medium">
                      {option.label}
                      {locked ? <LockPill /> : null}
                    </span>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      {option.description}
                    </span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Colour is its own axis, exactly as in the builder. */}
        <CvThemePicker
          onChange={(next) => {
            if (!themeAllowed(plan.plan, next)) {
              plan.upgrade(next.startsWith("#") ? "customThemeColor" : "allTemplates");
              return;
            }
            onThemeChange(next);
          }}
          size="sm"
          value={theme}
        />
      </div>

      {view === "pdf" ? (
        <div className="min-h-0 flex-1 p-4">
          {hasPdf ? (
            <div className="flex h-full min-h-0 flex-col gap-2">
              {/* The PDF is rendered from the saved CV, so it cannot show an
                  edit that has not been saved yet. Say so rather than letting
                  the two views quietly disagree. */}
              {dirty ? (
                <p className="shrink-0 rounded-lg bg-warning/12 px-3 py-2 text-warning text-xs">
                  This PDF is the saved version. Save your edits to rebuild it.
                </p>
              ) : null}
              <PdfViewer
                className="min-h-96 flex-1"
                key={pdfSrc}
                src={pdfSrc}
                title={`${title} CV${language ? ` (${language.toUpperCase()})` : ""}.pdf`}
              />
            </div>
          ) : (
            <div className="flex h-full min-h-96 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
              No PDF compiled yet.
            </div>
          )}
        </div>
      ) : (
        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto p-6">
          {shown ? (
            <CvPreview
              cv={shown}
              onChange={
                view === "edit"
                  ? (next) => {
                      setDraft(next);
                      setSave("dirty");
                    }
                  : undefined
              }
              showPhoto={withPhoto}
              template={template}
              theme={theme}
            />
          ) : (
            <p className="py-16 text-center text-muted-foreground text-sm">
              No CV has been generated for this application yet.
            </p>
          )}
        </div>
      )}

      {saveBar}
    </section>
  );
}

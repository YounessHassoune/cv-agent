"use client";

import { FileTextIcon, LayoutTemplateIcon, ScrollTextIcon } from "lucide-react";
import { useState } from "react";

import { type CvPreviewData, CvPreview } from "@/components/cv-preview";
import { PdfViewer } from "@/components/pdf-viewer";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CV_TEMPLATE_LIST } from "@/lib/cv-templates";
import { cn } from "@/lib/utils";

/**
 * The document, and only the document. It used to be one of three tabs sharing
 * a panel with the chat, which meant asking for a change hid the thing you were
 * changing. Here it holds the main column and never goes away; the chat sits
 * beside it.
 *
 * Preview and PDF are still a pair of views over the same CV, so they stay a
 * two-way toggle rather than becoming two panels.
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
}) {
  const [view, setView] = useState<"preview" | "pdf">("preview");
  // Preview-only, exactly as in the CV builder: the compiled PDF is photo-free
  // either way, so this never reaches the document the employer receives.
  const [showPhoto, setShowPhoto] = useState(true);

  const activeTemplate = CV_TEMPLATE_LIST.find((t) => t.id === template) ?? CV_TEMPLATE_LIST[0];
  const withPhoto = showPhoto && Boolean(cv?.photoUrl);

  const pdfQuery = new URLSearchParams({ template, photo: withPhoto ? "1" : "0" });
  if (language) pdfQuery.set("lang", language);
  // Same path after every recompile, so without this the browser serves the PDF
  // it already has and the user has to reload to see their own new CV.
  if (compiledAt) pdfQuery.set("v", compiledAt);
  const pdfSrc = `/api/applications/${applicationId}/pdf?${pdfQuery}`;

  const views = [
    { id: "preview" as const, label: "Preview", icon: ScrollTextIcon },
    { id: "pdf" as const, label: "PDF", icon: FileTextIcon },
  ];

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
              )}
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              <item.icon className="size-3.5" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Only offered when there is a photo to show. The profile is where one
            is uploaded, and an inert switch here would just puzzle. */}
        {cv?.photoUrl ? (
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
            if (next) onTemplateChange(next);
          }}
          value={template}
        >
          <SelectTrigger
            aria-label="CV template"
            className={cn(
              "shrink-0 gap-1.5 rounded-lg bg-card font-medium",
              cv?.photoUrl ? "" : "ml-auto",
            )}
            size="sm"
          >
            <LayoutTemplateIcon className="size-3.5" />
            <SelectValue>{activeTemplate.label}</SelectValue>
          </SelectTrigger>
          {/* Item-aligned positioning only (Base UI's default, and what Radix's
              default `position` did): the popper variant pins the list to the
              trigger's height and clips it. */}
          <SelectContent align="end" className="w-80">
            {CV_TEMPLATE_LIST.map((option) => (
              <SelectItem className="py-2" key={option.id} value={option.id}>
                {/* The wrapper must be its own flex column: SelectItem lays its
                    last span child out as a row. */}
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-muted-foreground text-xs leading-relaxed">
                    {option.description}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {view === "preview" ? (
        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto p-6">
          {cv ? (
            <CvPreview cv={cv} showPhoto={withPhoto} template={template} />
          ) : (
            <p className="py-16 text-center text-muted-foreground text-sm">
              No CV has been generated for this application yet.
            </p>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 p-4">
          {hasPdf ? (
            <PdfViewer
              className="h-full min-h-96"
              key={pdfSrc}
              src={pdfSrc}
              title={`${title} CV${language ? ` (${language.toUpperCase()})` : ""}.pdf`}
            />
          ) : (
            <div className="flex h-full min-h-96 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
              No PDF compiled yet.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

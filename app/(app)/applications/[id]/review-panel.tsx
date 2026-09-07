"use client";

import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import {
  FileTextIcon,
  LayoutTemplateIcon,
  MessageSquareIcon,
  ScrollTextIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ResumableAgentChat } from "@/app/(app)/_components/agent-chat";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CV_TEMPLATE_LIST } from "@/lib/cv-templates";
import { cn } from "@/lib/utils";

/**
 * Preview / PDF / Chat for one application. Every tab stays mounted
 * (`forceMount` + CSS hiding) so switching away from the chat never drops the
 * in-flight conversation.
 */
export function ReviewPanel({
  applicationId,
  title,
  compiledAt,
  cv,
  hasPdf,
  language,
  template,
  onTemplateChange,
  chatEvents,
  chatSession,
}: {
  readonly applicationId: string;
  readonly title: string;
  readonly cv: CvPreviewData | null;
  /** Last compile time of this variant; busts the PDF cache after a rebuild. */
  readonly compiledAt: string | null;
  readonly hasPdf: boolean;
  /** ISO code of the variant being shown; scopes the PDF tab. */
  readonly language?: string;
  readonly template: string;
  readonly onTemplateChange: (template: string) => void;
  readonly chatEvents?: readonly MessageStreamEvent[];
  readonly chatSession?: ClientSessionState;
}) {
  const router = useRouter();
  // Preview-only, exactly as in the CV builder: the compiled PDF is photo-free
  // either way, so this never reaches the document the employer receives.
  const [showPhoto, setShowPhoto] = useState(true);
  const activeTemplate = CV_TEMPLATE_LIST.find((t) => t.id === template) ?? CV_TEMPLATE_LIST[0];
  // Template and photo ride along so the PDF tab renders exactly what the
  // preview beside it shows.
  const withPhoto = showPhoto && Boolean(cv?.photoUrl);
  const pdfQuery = new URLSearchParams({ template, photo: withPhoto ? "1" : "0" });
  if (language) pdfQuery.set("lang", language);
  // Same path after every recompile, so without this the browser serves the
  // PDF it already has and the user has to reload to see their own new CV.
  if (compiledAt) pdfQuery.set("v", compiledAt);
  const pdfSrc = `/api/applications/${applicationId}/pdf?${pdfQuery}`;

  const resetThread = async () => {
    await fetch(`/api/applications/${applicationId}/chat`, { method: "DELETE" });
    // Re-renders with no stored session, so the next message opens a fresh one.
    router.refresh();
  };

  return (
    <Tabs
      className="flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-xl border bg-secondary/50"
      defaultValue="preview"
    >
      {/* Segmented bar sits on the panel's own header strip, as in the design.
          The photo switch and template picker share the strip so both choices
          are made against the document they restyle, as in the CV builder. */}
      <div className="flex shrink-0 items-center gap-2 border-b bg-card p-2">
        <TabsList className="min-w-0 gap-2 bg-transparent p-0">
          <TabsTrigger className="py-2 data-[state=active]:border-border" value="preview">
            <ScrollTextIcon className="size-3.5" />
            Preview
          </TabsTrigger>
          <TabsTrigger className="py-2 data-[state=active]:border-border" value="pdf">
            <FileTextIcon className="size-3.5" />
            PDF
          </TabsTrigger>
          <TabsTrigger className="py-2 data-[state=active]:border-border" value="chat">
            <MessageSquareIcon className="size-3.5" />
            Chat
          </TabsTrigger>
        </TabsList>

        {/* Only offered when there is a photo to show — the profile is where
            one is uploaded, and an inert switch here would just puzzle. */}
        {cv?.photoUrl ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Switch
              checked={showPhoto}
              id="show-photo-review"
              onCheckedChange={setShowPhoto}
            />
            <Label className="text-muted-foreground text-xs" htmlFor="show-photo-review">
              Photo
            </Label>
          </div>
        ) : null}

        <Select onValueChange={onTemplateChange} value={template}>
          <SelectTrigger
            aria-label="CV template"
            className={cn(
              "shrink-0 gap-1.5 rounded-full bg-card pr-2.5 pl-3.5 font-medium",
              cv?.photoUrl ? "" : "ml-auto",
            )}
            size="sm"
          >
            <LayoutTemplateIcon className="size-3.5" />
            <SelectValue>{activeTemplate.label}</SelectValue>
          </SelectTrigger>
          {/* Default (item-aligned) positioning only: this Select's popper
              variant pins the viewport to the trigger's height and clips. */}
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

      <TabsContent
        className="scrollbar-slim min-h-0 overflow-y-auto p-6 data-[state=inactive]:hidden"
        forceMount
        value="preview"
      >
        {cv ? (
          <CvPreview cv={cv} showPhoto={withPhoto} template={template} />
        ) : (
          <p className="py-16 text-center text-muted-foreground text-sm">
            No CV has been generated for this application yet.
          </p>
        )}
      </TabsContent>

      <TabsContent className="min-h-0 p-4 data-[state=inactive]:hidden" forceMount value="pdf">
        {hasPdf ? (
          <PdfViewer
            className="min-h-96"
            key={pdfSrc}
            src={pdfSrc}
            title={`${title} — CV${language ? ` (${language.toUpperCase()})` : ""}.pdf`}
          />
        ) : (
          <div className="flex h-full min-h-96 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
            No PDF compiled yet.
          </div>
        )}
      </TabsContent>

      <TabsContent
        className="min-h-0 overflow-hidden bg-card data-[state=inactive]:hidden"
        forceMount
        value="chat"
      >
        <ResumableAgentChat
          contextPrefix={`Context: I'm reviewing application ${applicationId} ("${title}"). Use get_profile and this application's stored job description and ATS report when answering.`}
          heading="Tailor AI"
          initialEvents={chatEvents}
          initialSession={chatSession}
          key={chatSession?.sessionId ?? "fresh"}
          onResetThread={resetThread}
          persistUrl={`/api/applications/${applicationId}/chat`}
          sessionId={chatSession?.sessionId}
          placeholder="Ask for a change to this CV…"
          subheading="Ask for rewrites, keyword coverage or a fresh PDF for this application."
          suggestions={[
            "Rewrite my bullets to cover the missing keywords",
            "Why is the ATS score not higher?",
            "Make the summary shorter and more specific",
            "Reframe my experience for this role",
          ]}
          variant="panel"
        />
      </TabsContent>
    </Tabs>
  );
}

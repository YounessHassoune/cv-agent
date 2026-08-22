"use client";

import { FileTextIcon, MessageSquareIcon, ScrollTextIcon } from "lucide-react";

import { AgentChat } from "@/app/(app)/_components/agent-chat";
import { type CvPreviewData, CvPreview } from "@/components/cv-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Preview / PDF / Chat for one application. Every tab stays mounted
 * (`forceMount` + CSS hiding) so switching away from the chat never drops the
 * in-flight conversation.
 */
export function ReviewPanel({
  applicationId,
  title,
  cv,
  hasPdf,
  template,
}: {
  readonly applicationId: string;
  readonly title: string;
  readonly cv: CvPreviewData | null;
  readonly hasPdf: boolean;
  readonly template: string;
}) {
  return (
    <Tabs
      className="flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-xl border bg-secondary/50"
      defaultValue="preview"
    >
      {/* Segmented bar sits on the panel's own header strip, as in the design. */}
      <TabsList className="w-full shrink-0 gap-2 rounded-none border-b bg-card p-2">
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

      <TabsContent
        className="scrollbar-slim min-h-0 overflow-y-auto p-6 data-[state=inactive]:hidden"
        forceMount
        value="preview"
      >
        {cv ? (
          <CvPreview cv={cv} template={template} />
        ) : (
          <p className="py-16 text-center text-muted-foreground text-sm">
            No CV has been generated for this application yet.
          </p>
        )}
      </TabsContent>

      <TabsContent className="min-h-0 p-4 data-[state=inactive]:hidden" forceMount value="pdf">
        {hasPdf ? (
          <iframe
            className="h-full min-h-96 w-full rounded-lg border bg-card"
            src={`/api/applications/${applicationId}/pdf`}
            title="Compiled CV"
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
        <AgentChat
          contextPrefix={`Context: I'm reviewing application ${applicationId} ("${title}"). Use get_profile and this application's stored job description and ATS report when answering.`}
          heading="Tailor AI"
          placeholder="Ask for a change to this CV…"
          subheading="Ask for rewrites, keyword coverage or a fresh PDF for this application."
          suggestions={[
            "Rewrite my bullets to cover the missing keywords",
            "Why is the ATS score not higher?",
            "Make the summary shorter and more specific",
            "Recompile this CV with the Classic template",
          ]}
          variant="panel"
        />
      </TabsContent>
    </Tabs>
  );
}

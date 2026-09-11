"use client";

import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import { BriefcaseIcon, GaugeIcon, MessageSquareIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { AtsReport } from "@/agent/lib/ats.ts";
import { ChatLockedNotice } from "@/components/chat-locked-notice";
import { usePlan } from "@/components/plan-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResumableAgentChat, StatusDot } from "@/features/chat";
import { gapSuggestions, InsightsPanel, LockedInsights, type ScoreSummary } from "./insights-panel";

const TABS = [
  { id: "insights", label: "Score", icon: GaugeIcon },
  { id: "chat", label: "Chat", icon: MessageSquareIcon },
  { id: "jd", label: "Job", icon: BriefcaseIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DEFAULT_TAB: TabId = "insights";

/** Anything unknown in the URL falls back rather than showing a blank rail. */
function toTab(value: string | null): TabId {
  return TABS.some((tab) => tab.id === value) ? (value as TabId) : DEFAULT_TAB;
}

/**
 * The rail beside the document: what the score says, the conversation about
 * fixing it, and the job description it is all measured against.
 *
 * Which panel is open is read from `?tab=`, so a link can land the user on the
 * one it was talking about — the chat link the landing page shows after a run
 * points here, and opening on the score instead made that link look broken.
 *
 * Chat used to be a peer tab of the CV itself, so asking for a change hid the
 * change. Here the document holds its own column and this rail sits next to it,
 * which is the whole point of the layout.
 *
 * Every panel stays mounted (`keepMounted` plus CSS hiding) so switching away
 * from the chat never drops an in-flight conversation.
 */
export function ReviewPanel({
  applicationId,
  title,
  jdText,
  language,
  report,
  score,
  unsupported,
  chatEvents,
  chatSession,
}: {
  readonly applicationId: string;
  readonly title: string;
  readonly jdText: string;
  /** ISO code of the variant being shown. */
  readonly language?: string;
  readonly report: AtsReport | null;
  /** The score itself, sent whatever the plan. */
  readonly score: ScoreSummary | null;
  /** Skills the CV claims that the master profile does not list. */
  readonly unsupported: string[];
  readonly chatEvents?: readonly MessageStreamEvent[];
  readonly chatSession?: ClientSessionState;
}) {
  const plan = usePlan();
  const router = useRouter();
  /*
   * The chat is behind a tab, and a run started on the landing page keeps
   * going here after navigation. With nothing on the tab itself the user had
   * no way to tell a working agent from a finished one without opening it.
   */
  const [chatBusy, setChatBusy] = useState(false);

  /*
   * The URL is the source of truth, but the selection is still held in state:
   * the panels stay mounted and a router navigation to change tabs would
   * re-run this dynamic page and cost a round trip for a local move. So the
   * state follows the URL when the URL changes, and a click writes the URL
   * back through the History API — the address stays shareable, the in-flight
   * chat below is untouched.
   */
  const searchParams = useSearchParams();
  const urlTab = toTab(searchParams.get("tab"));
  const [tab, setTab] = useState<TabId>(urlTab);
  useEffect(() => {
    setTab(urlTab);
  }, [urlTab]);

  const selectTab = (next: string) => {
    const value = toTab(next);
    setTab(value);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", value);
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  const resetThread = async () => {
    await fetch(`/api/applications/${applicationId}/chat`, { method: "DELETE" });
    // Re-renders with no stored session, so the next message opens a fresh one.
    router.refresh();
  };

  return (
    <Tabs
      className="flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-xl border bg-card"
      onValueChange={(next) => selectTab(String(next))}
      value={tab}
    >
      <div className="shrink-0 border-b p-2">
        <TabsList className="w-full gap-1 bg-transparent p-0">
          {TABS.map((tab) => (
            <TabsTrigger className="gap-1.5 py-2" key={tab.id} value={tab.id}>
              <tab.icon className="size-3.5" />
              {tab.label}
              {tab.id === "chat" && chatBusy ? <StatusDot hasError={false} isBusy /> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent className="min-h-0 data-hidden:hidden" keepMounted value="insights">
        {plan.can("atsScore") ? (
          <InsightsPanel language={language} report={report} unsupported={unsupported} />
        ) : (
          <LockedInsights
            score={score}
            language={language}
            onUpgrade={() => plan.upgrade("atsScore")}
          />
        )}
      </TabsContent>

      <TabsContent className="min-h-0 overflow-hidden data-hidden:hidden" keepMounted value="chat">
        {/* The thread stays readable on every plan — what a locked plan loses
            is the composer, not the conversation it already had. */}
        <ResumableAgentChat
          contextPrefix={`Context: I'm reviewing application ${applicationId} ("${title}"). Use get_profile and this application's stored job description and ATS report when answering.`}
          heading="Ask for a change"
          initialEvents={chatEvents}
          initialSession={chatSession}
          key={chatSession?.sessionId ?? "fresh"}
          onActivityChange={setChatBusy}
          lockedNotice={
            !plan.can("applicationChat") ? (
              <ChatLockedNotice reason="applicationChat" />
            ) : plan.usage.agentTurns >= plan.limits.agentTurns ? (
              <ChatLockedNotice reason="turns" />
            ) : undefined
          }
          onResetThread={resetThread}
          persistUrl={`/api/applications/${applicationId}/chat`}
          placeholder="Ask for a change to this CV…"
          sessionId={chatSession?.sessionId}
          subheading="The CV stays on screen while you work, so you can watch it change."
          // Derived from this variant's own report, so the one-tap prompts are
          // about the gaps this CV actually has rather than generic advice.
          suggestions={gapSuggestions(report, unsupported)}
          variant="panel"
        />
      </TabsContent>

      <TabsContent
        className="scrollbar-slim min-h-0 overflow-y-auto p-5 data-hidden:hidden"
        keepMounted
        value="jd"
      >
        <pre className="whitespace-pre-wrap font-sans text-muted-foreground text-xs leading-relaxed">
          {jdText}
        </pre>
      </TabsContent>
    </Tabs>
  );
}

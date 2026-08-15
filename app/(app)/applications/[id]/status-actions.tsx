"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2Icon, DownloadIcon, XCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function StatusActions({
  applicationId,
  status,
  hasPdf,
}: {
  readonly applicationId: string;
  readonly status: string;
  readonly hasPdf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const setStatus = async (next: "APPLIED" | "REJECTED") => {
    setBusy(true);
    await fetch(`/api/applications/${applicationId}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasPdf ? (
        <Button asChild size="sm" variant="outline">
          <a download href={`/api/applications/${applicationId}/pdf`}>
            <DownloadIcon className="size-3.5" />
            Download PDF
          </a>
        </Button>
      ) : null}
      {status !== "APPLIED" ? (
        <Button disabled={busy} onClick={() => setStatus("APPLIED")} size="sm">
          <CheckCircle2Icon className="size-3.5" />
          Mark as applied
        </Button>
      ) : null}
      {status !== "REJECTED" ? (
        <Button
          className="text-muted-foreground"
          disabled={busy}
          onClick={() => setStatus("REJECTED")}
          size="sm"
          variant="ghost"
        >
          <XCircleIcon className="size-3.5" />
          Discard
        </Button>
      ) : null}
    </div>
  );
}

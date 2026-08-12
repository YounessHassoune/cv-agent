"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function StatusActions({
  applicationId,
  status,
}: {
  readonly applicationId: string;
  readonly status: string;
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
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline">
        <a download href={`/api/applications/${applicationId}/pdf`}>
          Download PDF
        </a>
      </Button>
      {status !== "APPLIED" ? (
        <Button disabled={busy} onClick={() => setStatus("APPLIED")} size="sm">
          Mark as applied
        </Button>
      ) : null}
      {status !== "REJECTED" ? (
        <Button disabled={busy} onClick={() => setStatus("REJECTED")} size="sm" variant="ghost">
          Discard
        </Button>
      ) : null}
    </div>
  );
}

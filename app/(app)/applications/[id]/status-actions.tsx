"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2Icon, DownloadIcon, Trash2Icon, XCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

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

  const remove = async () => {
    setDeleting(true);
    setDeleteError(undefined);

    const response = await fetch(`/api/applications/${applicationId}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setDeleteError(body?.error ?? `Delete failed (${response.status}).`);
      setDeleting(false);
      return;
    }

    // The row is gone, so go back to the list rather than re-rendering a 404.
    router.push("/applications");
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

      <Dialog>
        <DialogTrigger asChild>
          <Button
            aria-label="Delete application"
            className="text-muted-foreground hover:text-destructive"
            size="sm"
            variant="ghost"
          >
            <Trash2Icon className="size-3.5" />
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this application?</DialogTitle>
            <DialogDescription>
              This removes the tailored CV, the ATS report, the compiled PDF and the chat history
              for this application. Your master profile is untouched. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError ? <p className="text-destructive text-sm">{deleteError}</p> : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={remove}
              type="button"
            >
              <Trash2Icon className="size-3.5" />
              {deleting ? "Deleting…" : "Delete application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

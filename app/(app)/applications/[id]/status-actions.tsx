"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CheckCircle2Icon,
  DownloadIcon,
  EllipsisVertical,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function StatusActions({
  applicationId,
  status,
  pdfLanguages,
}: {
  readonly applicationId: string;
  readonly status: string;
  /** Languages that have a compiled PDF — one download button each. */
  readonly pdfLanguages: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button className="shrink-0 text-muted-foreground" size="sm" variant="ghost">
              <EllipsisVertical className="size-4" />
            </Button>
          }
        />

        <DropdownMenuContent align="end" className="w-56">
          {pdfLanguages.map((language) => (
            <DropdownMenuItem
              key={language}
              render={
                <a
                  download
                  href={`/api/applications/${applicationId}/pdf?lang=${encodeURIComponent(language)}`}
                />
              }
            >
              <DownloadIcon className="size-4" />
              {pdfLanguages.length > 1 ? `Download PDF (${language.toUpperCase()})` : "Download PDF"}
            </DropdownMenuItem>
          ))}
          {pdfLanguages.length > 0 ? <DropdownMenuSeparator /> : null}

          {status !== "APPLIED" ? (
            <DropdownMenuItem disabled={busy} onClick={() => void setStatus("APPLIED")}>
              <CheckCircle2Icon className="size-4" />
              Mark as applied
            </DropdownMenuItem>
          ) : null}
          {status !== "REJECTED" ? (
            <DropdownMenuItem disabled={busy} onClick={() => void setStatus("REJECTED")}>
              <XCircleIcon className="size-4" />
              Discard
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />
          {/* Opens the dialog below rather than wrapping it: selecting an item
              closes the menu and unmounts its portal, which would take a dialog
              mounted inside with it. */}
          <DropdownMenuItem onClick={() => setConfirmOpen(true)} variant="destructive">
            <Trash2Icon className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
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
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              }
            />
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
    </>
  );
}

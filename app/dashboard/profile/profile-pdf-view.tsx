"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CvPreviewData } from "@/components/cv-preview";
import { PdfViewer } from "@/components/pdf-viewer";
import { Spinner } from "@/components/ui/spinner";
import { previewToCv } from "@/lib/cv-data";
import { cn } from "@/lib/utils";

/** Long enough that typing does not queue a render per keystroke. */
const DEBOUNCE_MS = 700;

/**
 * The builder's PDF view: the real compiled document, rendered from the draft
 * on screen rather than from the saved profile, so it shows unsaved edits like
 * the live preview beside it does.
 *
 * The bytes come back as a blob and are handed to the same viewer the review
 * page uses, so zoom, download and full-screen behave identically in both.
 */
export function ProfilePdfView({
  cv,
  template,
  theme,
  photo,
  className,
}: {
  readonly cv: CvPreviewData;
  readonly template: string;
  readonly theme: string;
  readonly photo: boolean;
  readonly className?: string;
}) {
  const [src, setSrc] = useState<string>();
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string>();
  // The blob URL currently held, so it can be released on unmount.
  const held = useRef<string>(undefined);

  // Serialized here so a re-render with an identical draft — which is every
  // keystroke in another field — does not queue another render.
  const body = useMemo(
    () =>
      JSON.stringify({
        cv: previewToCv(cv, cv.language ?? "en"),
        template,
        theme,
        photo,
      }),
    [cv, template, theme, photo],
  );

  useEffect(() => {
    const controller = new AbortController();
    setPending(true);

    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/profile/pdf", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Could not render the PDF (${response.status})`);

        const url = URL.createObjectURL(await response.blob());
        if (controller.signal.aborted) {
          URL.revokeObjectURL(url);
          return;
        }
        // The old document stays on screen until the new one is ready, so the
        // pane never blanks mid-render.
        setSrc((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return url;
        });
        held.current = url;
        setError(undefined);
        setPending(false);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not render the PDF.");
        setPending(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [body]);

  useEffect(
    () => () => {
      if (held.current) URL.revokeObjectURL(held.current);
    },
    [],
  );

  if (error && !src) {
    return (
      <div
        className={cn(
          "flex min-h-96 items-center justify-center rounded-lg border border-dashed px-6 text-center text-destructive text-sm",
          className,
        )}
      >
        {error}
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={cn(
          "flex min-h-96 items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground text-sm",
          className,
        )}
      >
        <Spinner className="size-4" />
        Rendering your CV…
      </div>
    );
  }

  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      {/* A rebuild is in flight while you keep typing: say so on the document
          you are still reading rather than replacing it with a spinner. */}
      {pending ? (
        <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-muted-foreground text-xs shadow-sm">
          <Spinner className="size-3" />
          Updating
        </span>
      ) : null}
      {error ? (
        <p className="shrink-0 rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-xs">
          {error}
        </p>
      ) : null}
      <PdfViewer className="min-h-96 flex-1" key={src} src={src} title="Your CV.pdf" />
    </div>
  );
}

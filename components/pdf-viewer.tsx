"use client";

import {
  DownloadIcon,
  ExternalLinkIcon,
  Maximize2Icon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Zoom stops, in percent. `null` means "fit the width", the default. */
const ZOOM_STOPS = [50, 75, 100, 125, 150, 200] as const;

/**
 * The built-in PDF plug-in draws its own grey toolbar, which looks nothing like
 * the rest of the app. We hide it (`#toolbar=0`) and drive the viewer through
 * the URL fragment instead, so the controls above the page are ours.
 *
 * Firefox ignores `toolbar=0` and keeps pdf.js' own bar — the document still
 * renders, it just gets two sets of controls there.
 */
function viewerSrc(src: string, zoom: number | null) {
  const view = zoom === null ? "view=FitH" : `zoom=${zoom}`;
  return `${src}#toolbar=0&navpanes=0&statusbar=0&messages=0&${view}`;
}

function ViewerFrame({
  src,
  zoom,
  title,
  className,
}: {
  readonly src: string;
  readonly zoom: number | null;
  readonly title: string;
  readonly className?: string;
}) {
  return (
    <iframe
      // Remounting on zoom is what makes the plug-in re-read the fragment.
      className={cn("h-full w-full bg-muted", className)}
      key={zoom ?? "fit"}
      src={viewerSrc(src, zoom)}
      title={title}
    />
  );
}

function ToolbarButton({
  label,
  onClick,
  href,
  download,
  children,
}: {
  readonly label: string;
  readonly onClick?: () => void;
  readonly href?: string;
  readonly download?: boolean;
  readonly children: React.ReactNode;
}) {
  const trigger = href ? (
    <a
      aria-label={label}
      className={cn(
        buttonVariants({ size: "icon", variant: "ghost" }),
        "size-7 text-muted-foreground",
      )}
      download={download}
      href={href}
      rel={download ? undefined : "noreferrer"}
      target={download ? undefined : "_blank"}
    >
      {children}
    </a>
  ) : (
    <Button
      aria-label={label}
      className="size-7 text-muted-foreground"
      onClick={onClick}
      size="icon"
      variant="ghost"
    >
      {children}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A PDF pane with the app's own controls: zoom, download, open in a new tab and
 * a full-screen dialog for reading the document at a sane size.
 */
export function PdfViewer({
  src,
  title = "Compiled CV",
  className,
  /** Hidden inside the dialog, where expanding again makes no sense. */
  expandable = true,
  closeControl,
}: {
  readonly src: string;
  readonly title?: string;
  readonly className?: string;
  readonly expandable?: boolean;
  /**
   * Sits at the end of the toolbar, where the expand button is on the inline
   * copy. The full-screen dialog passes its own close here rather than using
   * the dialog's floating one, which lands on top of the page it is covering.
   */
  readonly closeControl?: React.ReactNode;
}) {
  const [zoom, setZoom] = useState<number | null>(null);

  const step = (direction: 1 | -1) => {
    setZoom((current) => {
      const from = current ?? 100;
      const next = ZOOM_STOPS.filter((stop) => (direction === 1 ? stop > from : stop < from));
      if (next.length === 0) return current;
      return direction === 1 ? next[0] : next[next.length - 1];
    });
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5">
        <p className="mr-auto truncate pl-1 font-medium text-muted-foreground text-xs">{title}</p>

        <ToolbarButton label="Zoom out" onClick={() => step(-1)}>
          <MinusIcon className="size-3.5" />
        </ToolbarButton>
        <span className="w-11 text-center font-medium text-muted-foreground text-xs tabular-nums">
          {zoom === null ? "Fit" : `${zoom}%`}
        </span>
        <ToolbarButton label="Zoom in" onClick={() => step(1)}>
          <PlusIcon className="size-3.5" />
        </ToolbarButton>
        {zoom === null ? null : (
          <ToolbarButton label="Fit to width" onClick={() => setZoom(null)}>
            <RotateCcwIcon className="size-3.5" />
          </ToolbarButton>
        )}

        <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton download href={src} label="Download PDF">
          <DownloadIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton href={src} label="Open in a new tab">
          <ExternalLinkIcon className="size-3.5" />
        </ToolbarButton>

        {expandable ? (
          <Dialog>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DialogTrigger
                    render={
                      <Button
                        aria-label="View full size"
                        className="size-7 text-muted-foreground"
                        size="icon"
                        variant="ghost"
                      >
                        <Maximize2Icon className="size-3.5" />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent>View full size</TooltipContent>
            </Tooltip>

            {/* The dialog's own close button floats over whatever it covers,
                which here is the CV itself. Turned off, and re-hung at the end
                of the viewer's toolbar with the other controls. */}
            <DialogContent
              className="flex h-[92dvh] w-[min(72rem,calc(100vw-2rem))] max-w-none flex-col gap-3 p-4 sm:max-w-none"
              showCloseButton={false}
            >
              <DialogTitle className="sr-only">{title}</DialogTitle>
              <DialogDescription className="sr-only">
                Full-size view of the compiled CV.
              </DialogDescription>
              <PdfViewer
                className="min-h-0 flex-1"
                closeControl={
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <DialogClose
                          render={
                            <Button
                              aria-label="Close"
                              className="size-7 text-muted-foreground"
                              size="icon"
                              variant="ghost"
                            >
                              <XIcon className="size-3.5" />
                            </Button>
                          }
                        />
                      }
                    />
                    <TooltipContent>Close</TooltipContent>
                  </Tooltip>
                }
                expandable={false}
                src={src}
                title={title}
              />
            </DialogContent>
          </Dialog>
        ) : null}

        {closeControl}
      </div>

      <ViewerFrame className="min-h-0 flex-1" src={src} title={title} zoom={zoom} />
    </div>
  );
}

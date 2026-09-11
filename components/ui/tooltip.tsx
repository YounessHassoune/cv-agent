"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

/** Radix's `delayDuration` is `delay` in Base UI. */
function TooltipProvider({ delay = 0, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} {...props} />;
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

/**
 * Base UI splits Radix's single `Content` into `Positioner` (placement) and
 * `Popup` (the styled box). Every positioning prop is declared, destructured
 * and forwarded to the Positioner - leaving one on `...props` would land it on
 * the Popup, where it silently does nothing.
 */
function TooltipContent({
  className,
  children,
  align,
  alignOffset,
  side,
  sideOffset = 4,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 w-fit origin-(--transform-origin) rounded-md bg-foreground px-2.5 py-1.5 text-xs text-balance text-background shadow-soft",
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow
            className={cn(
              "size-2.5 rotate-45 rounded-[2px] bg-foreground",
              "data-[side=bottom]:top-1 data-[side=left]:right-[-13px] data-[side=left]:top-1/2! data-[side=left]:-translate-y-1/2 data-[side=right]:left-[-13px] data-[side=right]:top-1/2! data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5",
            )}
          />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };

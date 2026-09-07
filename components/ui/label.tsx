import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Base UI has no Label primitive: inside a Field the label is `Field.Label`, and
 * standalone it is a native `<label>`, which is all this ever was.
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex select-none items-center gap-2 font-medium text-sm leading-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };

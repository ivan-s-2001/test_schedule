import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-24 w-full rounded-md border border-input bg-[var(--outline-input-background)] px-3 py-2 text-[15px] leading-6 text-foreground shadow-none outline-none transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-muted-foreground/75 disabled:cursor-not-allowed disabled:opacity-50",
        "hover:border-muted-foreground/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

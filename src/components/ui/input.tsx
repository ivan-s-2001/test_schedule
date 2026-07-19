import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-input bg-[var(--outline-input-background)] px-3 py-1 text-[15px] text-foreground shadow-none outline-none transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-muted-foreground/75 selection:bg-[var(--accent-soft)] selection:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "hover:border-muted-foreground/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15",
        className
      )}
      {...props}
    />
  )
}

export { Input }

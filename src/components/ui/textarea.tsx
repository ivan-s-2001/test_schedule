import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-20 w-full rounded-sm border border-input bg-background px-3 py-2 text-[15px] leading-6 text-foreground shadow-none outline-none transition-[border-color,box-shadow] duration-100 placeholder:text-[#a2b2c3] disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-[#66778f] focus-visible:ring-0",
        "aria-invalid:border-destructive aria-invalid:ring-0",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

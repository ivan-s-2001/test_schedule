import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/20 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-[var(--outline-accent-hover)]",
        secondary:
          "border-transparent bg-[var(--accent-subtle)] text-[var(--accent-strong)] [a&]:hover:bg-[var(--accent-soft)]",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90",
        outline:
          "border-border bg-background text-secondary-foreground [a&]:hover:border-[var(--accent-border)] [a&]:hover:bg-[var(--accent-subtle)] [a&]:hover:text-foreground",
        ghost:
          "border-transparent text-secondary-foreground [a&]:hover:bg-[var(--accent-subtle)] [a&]:hover:text-foreground",
        link:
          "border-transparent text-[var(--accent-strong)] underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

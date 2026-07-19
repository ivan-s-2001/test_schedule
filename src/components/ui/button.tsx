import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-[background-color,color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-primary text-primary-foreground shadow-none hover:bg-[var(--outline-accent-hover)]",
        destructive:
          "border border-transparent bg-destructive text-white shadow-none hover:bg-destructive/90",
        outline:
          "border border-border bg-background text-foreground shadow-none hover:border-[var(--accent-border)] hover:bg-[var(--accent-subtle)]",
        secondary:
          "border border-transparent bg-[var(--accent-subtle)] text-[var(--accent-strong)] shadow-none hover:bg-[var(--accent-soft)]",
        ghost:
          "border border-transparent bg-transparent text-secondary-foreground shadow-none hover:bg-[var(--accent-subtle)] hover:text-foreground",
        link:
          "h-auto rounded-none p-0 text-[var(--accent-strong)] underline-offset-4 shadow-none hover:underline",
      },
      size: {
        default: "h-8 px-3 has-[>svg]:px-2.5",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-3 has-[>svg]:px-2.5",
        lg: "h-9 px-4 has-[>svg]:px-3",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

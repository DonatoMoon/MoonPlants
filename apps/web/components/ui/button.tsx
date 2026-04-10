import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";



const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
    {
      variants: {
        variant: {
          default:
              "border border-white bg-transparent text-white hover:bg-accent/20 hover:text-accent focus-visible:ring-accent",
          outline:
              "bg-accent text-white border border-main hover:bg-accent/90 rounded-md ",
          ghost:
              "bg-muted text-card-text border border-border hover:bg-accent/20 hover:text-main focus-visible:ring-accent",
          link:
              "bg-transparent text-white border-0 underline-offset-4 hover:text-accent focus-visible:ring-accent",
          destructive:
              "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",

        },
        size: {
          default: "h-10 px-4 py-2",
          sm: "h-8 px-3 text-sm",
          lg: "h-12 px-6 text-lg",
          icon: "size-10",
        },
      },
      defaultVariants: {
        variant: "default", // ← саме твоя головна біла кнопка!
        size: "default",
      },
    }
);



function Button({
                  className,
                  variant,
                  size,
                  asChild = false,
                  ...props
                }: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  return (
      <Comp
          data-slot="button"
          className={cn(buttonVariants({ variant, size, className }))}
          {...props}
      />
  );
}

export { Button, buttonVariants };

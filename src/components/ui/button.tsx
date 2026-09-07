import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-wide cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-primary-foreground bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-primary)_100%,white)_0%,var(--color-primary)_55%,color-mix(in_oklab,var(--color-primary)_82%,black)_100%)] shadow-[0_10px_24px_-10px_color-mix(in_oklab,var(--color-primary)_55%,transparent)] hover:shadow-[0_16px_32px_-12px_color-mix(in_oklab,var(--color-primary)_65%,transparent)] hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-primary/25 bg-background/60 text-foreground backdrop-blur-sm shadow-[0_1px_2px_rgba(10,132,209,0.06)] hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:-translate-y-0.5",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        success:
          "bg-success text-success-foreground shadow-sm hover:bg-success/90",
        warning:
          "bg-amber-500 text-slate-950 shadow-sm hover:bg-amber-400",
        ghost: "hover:bg-primary/10 hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline rounded-md",
      },
      size: {
        default: "h-11 px-6 py-2 min-w-[44px]",
        sm: "h-9 rounded-full px-4 text-xs",
        lg: "h-12 rounded-full px-8 text-[15px]",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, title, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        data-slot="button"
        data-variant={variant ?? "default"}
        data-size={size ?? "default"}
        className={cn(buttonVariants({ variant, size, className }))}
        title={title ?? props["aria-label"]}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

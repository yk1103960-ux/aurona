import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action = {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "default" | "outline";
};

export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  primary,
  secondary,
  className,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  primary?: Action;
  secondary?: Action;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("container-x flex min-h-[60vh] items-center justify-center py-16", className)}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md text-center"
      >
        {/* Floating illustration */}
        <div className="relative mx-auto mb-8 h-28 w-28">
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,color-mix(in_oklab,var(--color-gold)_22%,transparent),transparent_65%)]"
            animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="relative grid h-full w-full place-items-center rounded-full border border-border bg-surface shadow-soft"
            animate={reduce ? undefined : { y: [0, -6, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Icon className="h-11 w-11 text-primary" strokeWidth={1.4} />
          </motion.div>
        </div>

        {eyebrow && <div className="text-eyebrow text-gold">{eyebrow}</div>}
        <h1 className="text-display mt-2 text-3xl sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>

        {(primary || secondary) && (
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {primary && <ActionButton action={primary} />}
            {secondary && <ActionButton action={secondary} variant="outline" />}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ActionButton({ action, variant }: { action: Action; variant?: "outline" }) {
  const v = variant ?? action.variant ?? "default";
  const cls = "press h-12 min-w-[220px] rounded-full px-8 text-sm font-semibold uppercase tracking-[0.14em]";
  if (action.to) {
    return (
      <Button asChild variant={v} className={cls}>
        <Link to={action.to as never}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <Button variant={v} className={cls} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

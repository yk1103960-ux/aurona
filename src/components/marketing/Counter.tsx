import { useCountUp } from "@/hooks/useCountUp";

export function Counter({ to, suffix = "", label }: { to: number; suffix?: string; label: string }) {
  const { ref, value } = useCountUp(to);
  return (
    <div className="flex flex-col gap-1">
      <div className="text-display text-4xl leading-none text-foreground sm:text-5xl lg:text-6xl">
        <span ref={ref}>{value.toLocaleString("en-IN")}</span>
        <span className="text-gold">{suffix}</span>
      </div>
      <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/60">{label}</div>
    </div>
  );
}

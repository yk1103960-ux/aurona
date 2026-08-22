import * as React from "react";
import { cn } from "@/lib/utils";

/** Keeps only digits and caps at 10 — used for typing, pasting and drops. */
export function sanitiseMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Tolerate a pasted country code (91XXXXXXXXXX / 0XXXXXXXXXX) by keeping the last 10.
  const trimmed =
    digits.length > 10 && (digits.startsWith("91") || digits.startsWith("0"))
      ? digits.slice(-10)
      : digits;
  return trimmed.slice(0, 10);
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
  className?: string;
};

/**
 * India-only mobile field: fixed +91 prefix, digits only, hard 10-digit cap.
 * Letters, spaces, symbols and emoji can never appear in the visible value —
 * every mutation path (typing, paste, drop, autofill) runs through sanitiseMobile.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, Props>(function PhoneInput(
  { value, onChange, id, name, required, disabled, placeholder = "98765 43210", autoComplete = "tel-national", invalid, className },
  ref,
) {
  const set = (raw: string) => onChange(sanitiseMobile(raw));

  return (
    <div
      className={cn(
        "mt-1 flex h-11 w-full items-center overflow-hidden rounded-md border border-input bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0",
        invalid && "border-destructive",
        disabled && "opacity-60",
        className,
      )}
    >
      <span className="select-none border-r border-input px-3 text-sm font-semibold text-muted-foreground">
        +91
      </span>
      <input
        ref={ref}
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        pattern="[0-9]{10}"
        maxLength={10}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => set(e.target.value)}
        onBeforeInput={(e) => {
          // Block non-digit insertions before they ever reach the DOM value.
          const data = (e as unknown as { data?: string | null }).data;
          if (data && /\D/.test(data)) e.preventDefault();
        }}
        onKeyDown={(e) => {
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !/\d/.test(e.key)) e.preventDefault();
        }}
        onPaste={(e) => {
          e.preventDefault();
          set(value + e.clipboardData.getData("text"));
        }}
        onDrop={(e) => {
          e.preventDefault();
          set(value + e.dataTransfer.getData("text"));
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm tracking-[0.08em] outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
});

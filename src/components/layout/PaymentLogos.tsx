/** Inline brand marks for accepted payment methods (no external requests). */

function Card({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span
      aria-label={label}
      title={label}
      className="grid h-9 w-[62px] place-items-center rounded-lg border border-primary/12 bg-white px-2 shadow-[0_1px_2px_rgba(10,132,209,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_10px_20px_-14px_rgba(10,132,209,0.55)]"
    >
      {children}
    </span>
  );
}

function Upi() {
  return (
    <svg viewBox="0 0 80 28" className="h-4 w-auto" role="img" aria-hidden>
      <polygon points="4,4 20,4 12,24" fill="#097939" />
      <polygon points="14,4 30,4 22,24" fill="#ED752E" />
      <text x="34" y="20" fontFamily="Arial, Helvetica, sans-serif" fontSize="15" fontWeight="700" fill="#0F172A">
        UPI
      </text>
    </svg>
  );
}

function Paytm() {
  return (
    <svg viewBox="0 0 90 28" className="h-4 w-auto" role="img" aria-hidden>
      <text x="0" y="20" fontFamily="Arial, Helvetica, sans-serif" fontSize="17" fontWeight="700" fill="#00BAF2">
        pay
      </text>
      <text x="31" y="20" fontFamily="Arial, Helvetica, sans-serif" fontSize="17" fontWeight="700" fill="#20336B">
        tm
      </text>
    </svg>
  );
}

function Mastercard() {
  return (
    <svg viewBox="0 0 48 30" className="h-5 w-auto" role="img" aria-hidden>
      <circle cx="18" cy="15" r="11" fill="#EB001B" />
      <circle cx="30" cy="15" r="11" fill="#F79E1B" />
      <path d="M24 6a11 11 0 0 0 0 18 11 11 0 0 0 0-18Z" fill="#FF5F00" />
    </svg>
  );
}

function Visa() {
  return (
    <svg viewBox="0 0 64 22" className="h-3.5 w-auto" role="img" aria-hidden>
      <text
        x="0"
        y="17"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="18"
        fontStyle="italic"
        fontWeight="700"
        fill="#1A1F71"
        letterSpacing="1"
      >
        VISA
      </text>
    </svg>
  );
}

function RuPay() {
  return (
    <svg viewBox="0 0 86 28" className="h-4 w-auto" role="img" aria-hidden>
      <text x="0" y="20" fontFamily="Arial, Helvetica, sans-serif" fontSize="16" fontWeight="700" fill="#097939">
        Ru
      </text>
      <text x="24" y="20" fontFamily="Arial, Helvetica, sans-serif" fontSize="16" fontWeight="700" fill="#F26522">
        Pay
      </text>
    </svg>
  );
}

export function PaymentLogos({ className = "" }: { className?: string }) {
  return (
    <div className={"flex items-center gap-2.5 " + className}>
      <Card label="UPI"><Upi /></Card>
      <Card label="Paytm"><Paytm /></Card>
      <Card label="Mastercard"><Mastercard /></Card>
      <Card label="Visa"><Visa /></Card>
      <Card label="RuPay"><RuPay /></Card>
    </div>
  );
}

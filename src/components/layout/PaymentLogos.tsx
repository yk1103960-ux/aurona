import { cn } from "@/lib/utils";

function Upi() {
  return (
    <svg viewBox="0 0 80 28" className="h-5 w-auto" role="img" aria-hidden>
      <polygon points="4,4 20,4 12,24" fill="#097939" />
      <polygon points="14,4 30,4 22,24" fill="#ED752E" />
      <text x="34" y="19" fontFamily="Arial, Helvetica, sans-serif" fontSize="15" fontWeight="700" fill="#E8F4FD">
        UPI
      </text>
    </svg>
  );
}

function Paytm() {
  return (
    <svg viewBox="0 0 90 28" className="h-5 w-auto" role="img" aria-hidden>
      <text x="0" y="19" fontFamily="Arial, Helvetica, sans-serif" fontSize="17" fontWeight="700" fill="#00BAF2">
        pay
      </text>
      <text x="31" y="19" fontFamily="Arial, Helvetica, sans-serif" fontSize="17" fontWeight="700" fill="#E8F4FD">
        tm
      </text>
    </svg>
  );
}

function Mastercard() {
  return (
    <svg viewBox="0 0 48 30" className="h-7 w-auto" role="img" aria-hidden>
      <circle cx="18" cy="15" r="11" fill="#EB001B" />
      <circle cx="30" cy="15" r="11" fill="#F79E1B" />
      <path d="M24 6a11 11 0 0 0 0 18 11 11 0 0 0 0-18Z" fill="#FF5F00" />
    </svg>
  );
}

function Visa() {
  return (
    <svg viewBox="0 0 64 22" className="h-5 w-auto" role="img" aria-hidden>
      <text
        x="0"
        y="16"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="18"
        fontStyle="italic"
        fontWeight="700"
        fill="#E8F4FD"
        letterSpacing="1"
      >
        VISA
      </text>
    </svg>
  );
}

function RuPay() {
  return (
    <svg viewBox="0 0 86 28" className="h-5 w-auto" role="img" aria-hidden>
      <text x="0" y="19" fontFamily="Arial, Helvetica, sans-serif" fontSize="16" fontWeight="700" fill="#097939">
        Ru
      </text>
      <text x="24" y="19" fontFamily="Arial, Helvetica, sans-serif" fontSize="16" fontWeight="700" fill="#F26522">
        Pay
      </text>
    </svg>
  );
}

export function PaymentLogos({ className = "" }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 sm:gap-5", className)}>
      <span className="flex h-7 items-center justify-center opacity-90 transition-opacity duration-300 hover:opacity-100" aria-label="UPI">
        <Upi />
      </span>
      <span className="flex h-7 items-center justify-center opacity-90 transition-opacity duration-300 hover:opacity-100" aria-label="Paytm">
        <Paytm />
      </span>
      <span className="flex h-7 items-center justify-center opacity-90 transition-opacity duration-300 hover:opacity-100" aria-label="Mastercard">
        <Mastercard />
      </span>
      <span className="flex h-7 items-center justify-center opacity-90 transition-opacity duration-300 hover:opacity-100" aria-label="Visa">
        <Visa />
      </span>
      <span className="flex h-7 items-center justify-center opacity-90 transition-opacity duration-300 hover:opacity-100" aria-label="RuPay">
        <RuPay />
      </span>
    </div>
  );
}

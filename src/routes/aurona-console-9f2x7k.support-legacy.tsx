import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Headphones, MessageSquareText } from "lucide-react";

const ROOT = "/aurona-console-9f2x7k";
export const Route = createFileRoute('/aurona-console-9f2x7k/support-legacy')({ component: SupportEntry });

function SupportEntry() {
  return <div className="space-y-5">
    <div className="border-b bg-white px-5 py-4 shadow-sm"><h1 className="text-xl font-semibold">Support</h1><p className="mt-1 text-sm text-slate-500">Customer support tickets and conversations.</p></div>
    <Link to={`${ROOT}/support`} className="group block max-w-2xl rounded border bg-white p-5 shadow-sm hover:border-[#25a36f]">
      <div className="flex items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded bg-emerald-50 text-[#25a36f]"><Headphones className="h-5 w-5"/></div><div className="flex-1"><div className="flex items-center justify-between"><h2 className="font-semibold">Support Inbox</h2><ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#25a36f]"/></div><p className="mt-2 text-sm leading-6 text-slate-500">Open the connected support workspace to manage customer messages, ticket conversations and replies.</p><div className="mt-4 flex items-center gap-2 text-xs font-medium text-[#25a36f]"><MessageSquareText className="h-4 w-4"/> Open support conversations</div></div></div>
    </Link>
  </div>;
}

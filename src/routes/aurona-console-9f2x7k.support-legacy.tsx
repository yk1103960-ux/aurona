import { createFileRoute, Link } from "@tanstack/react-router";
import { LegacyModulePage } from "@/components/admin/ecommain/LegacyModulePage";
const ROOT='/aurona-console-9f2x7k';
export const Route=createFileRoute('/aurona-console-9f2x7k/support-legacy')({component:SupportLegacy});
function SupportLegacy(){return <div className="space-y-4"><LegacyModulePage title="Support" description="Original support ticket and conversation management area." columns={["#","Ticket ID","Subject","Customer","Status","Last Reply","Options"]} actions={[]}/><Link to={`${ROOT}/support`} className="text-sm font-medium text-[#25b990]">Open connected support inbox →</Link></div>}

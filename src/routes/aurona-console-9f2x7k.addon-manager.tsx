import { createFileRoute } from "@tanstack/react-router";
import { LegacyModulePage } from "@/components/admin/ecommain/LegacyModulePage";
export const Route=createFileRoute('/aurona-console-9f2x7k/addon-manager')({component:()=> <LegacyModulePage title="Addon Manager" description="Installed Active eCommerce addons and activation state." columns={["#","Addon","Version","Purchase Code","Status","Options"]} actions={["Install/Update Addon"]}/>});

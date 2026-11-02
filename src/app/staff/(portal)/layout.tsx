import { requireRole } from "@/auth/request";
import { PortalShell } from "@/components/portal/PortalShell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("staff");
  return <PortalShell role={user.role} name={user.name}>{children}</PortalShell>;
}

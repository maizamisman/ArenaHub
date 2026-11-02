import { requireRole } from "@/auth/request";
import { ScorePage } from "@/components/portal/ScorePage";

export const metadata = { title: "Live Score Control · ArenaHub" };

export default async function AdminScore({ params }: PageProps<"/staff/admin/score/[id]">) {
  const me = await requireRole("admin");
  return <ScorePage me={me} id={(await params).id} back="/staff/admin/matches" />;
}

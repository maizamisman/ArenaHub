import { requireRole } from "@/auth/request";
import { ScorePage } from "@/components/portal/ScorePage";

export const metadata = { title: "Live Score Control · ArenaHub" };

export default async function PicScore({ params }: PageProps<"/staff/pic/score/[id]">) {
  const me = await requireRole("pic");
  return <ScorePage me={me} id={(await params).id} back="/staff/pic/matches" />;
}

import { getLiveSnapshot } from "@/data/matches";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getLiveSnapshot(), { headers: { "Cache-Control": "no-store" } });
}

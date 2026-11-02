import { NextResponse, type NextRequest } from "next/server";
import { reportPhoto } from "@/data/photos";
import { deviceFromRequest, withDeviceCookie } from "@/lib/device";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/photos/[id]/report">) {
  const { id } = await ctx.params;
  const dev = deviceFromRequest(req);
  return withDeviceCookie(NextResponse.json(reportPhoto(id, dev.hash)), dev.newId);
}

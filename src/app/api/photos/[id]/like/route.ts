import { NextResponse, type NextRequest } from "next/server";
import { likePhoto, unlikePhoto } from "@/data/photos";
import { deviceFromRequest, withDeviceCookie } from "@/lib/device";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/photos/[id]/like">) {
  const { id } = await ctx.params;
  const dev = deviceFromRequest(req);
  return withDeviceCookie(NextResponse.json(likePhoto(id, dev.hash)), dev.newId);
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/photos/[id]/like">) {
  const { id } = await ctx.params;
  const dev = deviceFromRequest(req);
  return withDeviceCookie(NextResponse.json(unlikePhoto(id, dev.hash)), dev.newId);
}
